import { shopAIKeyFetch } from '@/lib/shopaikey';
import type { PromptSuggestion } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const API_BRAND = "Mai Đức Minh'web API";
const HUMAN_IDENTITY_CONSTRAINT = 'When reference images contain a person, preserve the exact same person and identity: facial structure, eyes, nose, lips, skin tone, hairstyle, age appearance, body proportions, distinctive features, clothing and accessories unless the user explicitly requests a change. Do not substitute, merge, beautify into a different face, or invent a different person.';

function parseJsonObject(text: string) {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
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
      const rawPrompt = String(row.prompt || '').trim();
      return {
        title: String(row.title || `Gợi ý ${index + 1}`),
        prompt: rawPrompt ? `${rawPrompt}\n\nREFERENCE IDENTITY RULE: ${HUMAN_IDENTITY_CONSTRAINT}` : '',
        descriptionVi: String(row.description_vi || row.descriptionVi || row.why || '').trim(),
        why: String(row.why || '').trim(),
      };
    })
    .filter((item) => item.prompt.length > 0);

  if (normalized.length !== 3) throw new Error('GPT-5.4 did not return exactly 3 usable prompts');
  return normalized;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const description = String(body.description || '').trim();
    const referenceImages: string[] = (Array.isArray(body.referenceImages) ? body.referenceImages : [])
      .map((value: unknown) => String(value))
      .filter(Boolean)
      .slice(0, 4);

    if (description.length < 10) {
      return Response.json({ error: 'Hãy mô tả hình ảnh rõ hơn (ít nhất 10 ký tự).' }, { status: 400 });
    }

    const userText = [
      `Yêu cầu tạo ảnh của người dùng:\n${description}`,
      referenceImages.length
        ? `\nCó ${referenceImages.length} ảnh tham chiếu. Phân tích kỹ nhân vật, vật thể, màu sắc, chất liệu, logo/chữ và các chi tiết nhận diện.`
        : '\nKhông có ảnh tham chiếu.',
      '\nTạo đúng 3 phương án prompt khác nhau về bố cục/phong cách nhưng vẫn bám sát yêu cầu.',
    ].join('');

    const content = referenceImages.length
      ? [
          { type: 'text', text: userText },
          ...referenceImages.map((url) => ({ type: 'image_url', image_url: { url } })),
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
              'You are a senior AI image prompt director specialized in production-ready prompts for gpt-image-2-all.',
              'Return JSON only. Do not use markdown fences.',
              'Schema: {"suggestions":[{"title":"Vietnamese short title","prompt":"English production-ready image prompt","description_vi":"Detailed Vietnamese description of the expected image","why":"Vietnamese concise rationale"}]}.',
              'Return exactly 3 suggestions.',
              'For each suggestion, description_vi should be concrete Vietnamese, around 4-6 sentences, explaining subject, composition, camera/viewpoint, environment, lighting/color/mood, textures/materials and important details that will be preserved.',
              'Each English prompt must be self-contained and optimized for one still image.',
              HUMAN_IDENTITY_CONSTRAINT,
              'When references contain products, architecture, logos or text, preserve their defining geometry, layout, colors, materials and existing text unless the user asks to change them.',
              'Do not invent extra text, logos, watermarks, people or objects unless requested.',
              'Make the three options meaningfully different: cinematic/editorial realism, dynamic/story-focused composition, and controlled premium/commercial composition when applicable.',
            ].join(' '),
          },
          { role: 'user', content },
        ],
        max_tokens: 4200,
        temperature: 0.8,
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      console.error('ShopAIKey image prompt error', response.status, raw);
      return Response.json({ error: `${API_BRAND} · lỗi GPT (${response.status}): ${raw.slice(0, 500)}` }, { status: 502 });
    }

    const data = JSON.parse(raw);
    const outputText = data?.choices?.[0]?.message?.content;
    if (typeof outputText !== 'string') {
      return Response.json({ error: 'Không đọc được nội dung trả về từ GPT-5.4.' }, { status: 502 });
    }

    return Response.json({ suggestions: normalizeSuggestions(parseJsonObject(outputText)) });
  } catch (error) {
    console.error('image prompt generation error', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Image prompt generation failed' }, { status: 500 });
  }
}
