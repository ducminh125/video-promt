import { createPromptHistory } from '@/lib/db';
import { shopAIKeyFetch } from '@/lib/shopaikey';
import type { PromptSuggestion, SourceMedia } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

function parseJsonObject(text: string) {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('GPT-5.4 did not return valid JSON');
  }
}

function normalizeSuggestions(value: unknown): PromptSuggestion[] {
  if (!value || typeof value !== 'object') throw new Error('Invalid prompt response');
  const suggestions = (value as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(suggestions)) throw new Error('Missing suggestions array');

  const normalized = suggestions
    .slice(0, 3)
    .map((item, index) => {
      const row = item as Record<string, unknown>;
      return {
        title: String(row.title || `Gợi ý ${index + 1}`),
        prompt: String(row.prompt || '').trim(),
        why: String(row.why || '').trim(),
      };
    })
    .filter((item) => item.prompt.length > 0);

  if (normalized.length !== 3) {
    throw new Error('GPT-5.4 did not return exactly 3 usable prompts');
  }
  return normalized;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const description = String(body.description || '').trim();
    const sourceMedia = (Array.isArray(body.sourceMedia) ? body.sourceMedia : []) as SourceMedia[];
    const referenceImages: string[] = (Array.isArray(body.referenceImages) ? body.referenceImages : [])
      .map((value: unknown) => String(value))
      .filter((url: string) => url.length > 0)
      .slice(0, 8);

    if (description.length < 10) {
      return Response.json({ error: 'Hãy mô tả nội dung video rõ hơn (ít nhất 10 ký tự).' }, { status: 400 });
    }

    const userText = [
      `Yêu cầu của người dùng:\n${description}`,
      referenceImages.length
        ? `\nCó ${referenceImages.length} ảnh/frame tham chiếu. Hãy quan sát chúng và giữ các đặc điểm quan trọng phù hợp với yêu cầu.`
        : '\nKhông có ảnh tham chiếu.',
      '\nHãy tạo đúng 3 phương án prompt khác nhau về cách dàn dựng/camera nhưng vẫn bám sát yêu cầu.',
    ].join('');

    const content = referenceImages.length
      ? [
          { type: 'text', text: userText },
          ...referenceImages.map((url) => ({
            type: 'image_url',
            image_url: { url },
          })),
        ]
      : userText;

    const response = await shopAIKeyFetch('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5.4',
        messages: [
          {
            role: 'system',
            content: [
              'You are a senior AI video prompt director specialized in Grok Video 3.',
              'Return JSON only. Do not use markdown fences.',
              'Schema: {"suggestions":[{"title":"Vietnamese short title","prompt":"English production-ready video prompt","why":"Vietnamese concise rationale"}]}.',
              'Return exactly 3 suggestions.',
              'Each prompt should be self-contained and ready to send directly to grok-video-3.',
              'Include subject, action, environment, camera/lens/movement, composition, lighting, material/texture fidelity, motion behavior, mood, and continuity constraints when relevant.',
              'When reference images are supplied, preserve identity, architecture, proportions, layout, materials, logos/text already present, and other defining details unless the user asks to change them.',
              'Do not invent extra text, watermarks, logos, people, buildings, or objects unless the user requests them.',
              'Make the 3 options meaningfully different: cinematic realism, dynamic camera/storytelling, and controlled premium/product/architectural style when applicable.',
            ].join(' '),
          },
          { role: 'user', content },
        ],
        max_tokens: 2600,
        temperature: 0.8,
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      console.error('ShopAIKey GPT error', response.status, raw);
      return Response.json({ error: `ShopAIKey GPT error (${response.status}): ${raw.slice(0, 500)}` }, { status: 502 });
    }

    const data = JSON.parse(raw);
    const outputText = data?.choices?.[0]?.message?.content;
    if (typeof outputText !== 'string') {
      return Response.json({ error: 'Không đọc được nội dung trả về từ GPT-5.4.' }, { status: 502 });
    }

    const suggestions = normalizeSuggestions(parseJsonObject(outputText));
    const historyId = crypto.randomUUID();

    await createPromptHistory({
      id: historyId,
      description,
      promptOptions: suggestions,
      sourceMedia,
      referenceImages,
    });

    return Response.json({ historyId, suggestions });
  } catch (error) {
    console.error('prompt generation error', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Prompt generation failed' },
      { status: 500 },
    );
  }
}
