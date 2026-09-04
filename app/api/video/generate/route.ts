import { attachVideoTask } from '@/lib/db';
import { shopAIKeyFetch } from '@/lib/shopaikey';
import type { VideoSettings } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const FIXED_VIDEO_DURATION = 10;
const VIDEO_MODEL = 'grok-video-3-10s';
<<<<<<< Updated upstream
const PROMPT_OPTIMIZER_MODEL = process.env.PROMPT_OPTIMIZER_MODEL || 'gpt-5.4';
const API_BRAND = "Mai Đức Minh'web API";
const HUMAN_IDENTITY_CONSTRAINT = 'REFERENCE IDENTITY: keep the exact same person from reference images. Preserve face, facial structure, skin tone, hairstyle, age appearance, body proportions, clothing, accessories and distinctive details unless the approved direction explicitly requests a change. Never substitute, merge, reinterpret or beautify the person into a different identity.';

// Grok Video rejects prompts over 4096. Keep a safety margin for provider-side counting.
// IMPORTANT: We do not truncate to this size. GPT-5.4 must semantically compile the full request below it.
const MAX_VIDEO_PROMPT_CHARS = 3600;
const MAX_VIDEO_PROMPT_BYTES = 3900;
const FIRST_PASS_TARGET_CHARS = 3400;
const VERIFICATION_PASS_TARGET_CHARS = 3200;

type OptimizerPayload = {
  optimized_prompt?: unknown;
  coverage_complete?: unknown;
  missing_details?: unknown;
};
=======
const MAX_VIDEO_PROMPT_CHARS = 4096;
const API_BRAND = "Mai Đức Minh'web API";

function utf8Length(value: string) {
  return Buffer.byteLength(value, 'utf8');
}
>>>>>>> Stashed changes

function asNonEmptyString(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function getTaskId(payload: any) {
  const candidates = [
    typeof payload === 'string' ? payload : '',
    payload?.data?.task_id,
    payload?.task_id,
    payload?.data?.taskId,
    payload?.taskId,
    payload?.task?.task_id,
    payload?.task?.taskId,
    payload?.data?.task?.task_id,
    payload?.data?.task?.taskId,
    payload?.data?.[0]?.task_id,
    payload?.data?.[0]?.taskId,
    payload?.[0]?.task_id,
    payload?.[0]?.taskId,
    payload?.data?.id,
    payload?.id,
    typeof payload?.data === 'string' ? payload.data : '',
  ];

  for (const candidate of candidates) {
    const value = asNonEmptyString(candidate);
    if (value) return value;
  }
  return '';
}

function getInitialStatus(payload: any) {
  return asNonEmptyString(payload?.data?.status) || asNonEmptyString(payload?.status) || 'queued';
}

function utf8Length(value: string) {
  return Buffer.byteLength(value, 'utf8');
}

function parseJsonObject(text: string): OptimizerPayload {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned) as OptimizerPayload;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as OptimizerPayload;
    }
    throw new Error('GPT-5.4 không trả về JSON hợp lệ khi hoàn thiện prompt video.');
  }
}

function getAssistantText(data: any) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === 'string' ? part.text : typeof part === 'string' ? part : ''))
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function promptFitsVideoLimit(prompt: string) {
  return prompt.length <= MAX_VIDEO_PROMPT_CHARS && utf8Length(prompt) <= MAX_VIDEO_PROMPT_BYTES;
}

async function requestOptimizedPrompt(params: {
  descriptionVi: string;
  technicalPrompt: string;
  hasReferenceImages: boolean;
  settings: VideoSettings;
  targetChars: number;
  previousAttempt?: string;
}) {
  const { descriptionVi, technicalPrompt, hasReferenceImages, settings, targetChars, previousAttempt } = params;
  const referenceRule = hasReferenceImages
    ? HUMAN_IDENTITY_CONSTRAINT
    : 'There are no reference images. Do not invent identity-preservation requirements.';

  const systemInstruction = [
    'You are a lossless prompt compiler for Grok Video 3, not a creative rewriter.',
    'Your job is to convert the complete user-approved direction plus the selected technical prompt into ONE compact, production-ready English video prompt.',
    'The downstream video API has a strict prompt-length limit. Semantic compression is mandatory: merge duplicate ideas, replace verbose wording with precise film terminology, remove repetition, and use compact clauses.',
    'LOSSLESS RULE: preserve every unique requirement that can affect the visible or audible result. Never silently drop a subject, object, action, sequence, location, time, relationship, camera instruction, framing, movement, lens/look, lighting, color, mood, material, texture, timing, continuity rule, identity constraint, clothing/accessory detail, spoken line, language/accent/voice requirement, visible text, logo, proper noun, number, or explicit negative constraint.',
    'The APPROVED VIETNAMESE DIRECTION is authoritative. If it conflicts with the older technical prompt, follow the Vietnamese direction and keep compatible technical details only.',
    'Do not invent new people, objects, text, dialogue, logos, camera events, or story beats.',
    `The final optimized_prompt MUST be at most ${targetChars} characters and should use mostly ASCII English so its UTF-8 byte count stays low. Exact requested dialogue, proper nouns, labels, signs or visible text may remain in their original language.`,
    'It must describe one coherent continuous 10-second clip. Prefer semicolons and compact production terms instead of full explanatory sentences.',
    previousAttempt
      ? 'This is the verification/repair pass. Compare the candidate prompt against BOTH original source blocks detail by detail, repair any omission or ambiguity, and return the repaired final prompt. Do not trust the candidate merely because it looks complete.'
      : 'This is the compilation pass. Before answering, internally compare the optimized prompt against BOTH source blocks and verify that all unique requirements are represented either explicitly or by an unambiguous compact equivalent.',
    'Return JSON only, without markdown. Schema: {"optimized_prompt":"...","coverage_complete":true,"missing_details":[]}.',
    'Set coverage_complete=false and list missing_details only if you genuinely cannot preserve all unique requirements inside the character target. Do not claim completeness if you omitted a requirement.',
  ].join(' ');

  const source = [
    `VIDEO FORMAT: model=${VIDEO_MODEL}; duration=${FIXED_VIDEO_DURATION}s; ratio=${settings.ratio}; resolution=${settings.resolution}.`,
    `REFERENCE RULE: ${referenceRule}`,
    `\nAPPROVED VIETNAMESE DIRECTION (highest priority):\n${descriptionVi}`,
    technicalPrompt
      ? `\nSELECTED TECHNICAL PROMPT (secondary; preserve all compatible unique details):\n${technicalPrompt}`
      : '\nSELECTED TECHNICAL PROMPT: none.',
    previousAttempt
      ? `\nCANDIDATE PROMPT FROM PASS 1 (audit it against the original sources, repair omissions, then compact if needed):\n${previousAttempt}`
      : '',
  ].join('\n');

  const response = await shopAIKeyFetch('/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: PROMPT_OPTIMIZER_MODEL,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: source },
      ],
      max_tokens: 1800,
      temperature: 0.15,
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    console.error('GPT prompt optimizer error', response.status, raw);
    throw new Error(`${API_BRAND} · lỗi ${PROMPT_OPTIMIZER_MODEL} khi hoàn thiện prompt (${response.status}): ${raw.slice(0, 400)}`);
  }

  let data: any;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`${API_BRAND} trả về dữ liệu GPT không hợp lệ khi hoàn thiện prompt.`);
  }

  const outputText = getAssistantText(data);
  if (!outputText) throw new Error(`Không đọc được prompt hoàn thiện từ ${PROMPT_OPTIMIZER_MODEL}.`);

  const parsed = parseJsonObject(outputText);
  const optimizedPrompt = asNonEmptyString(parsed.optimized_prompt);
  const missingDetails = Array.isArray(parsed.missing_details)
    ? parsed.missing_details.map((item) => asNonEmptyString(item)).filter(Boolean)
    : [];
  const coverageComplete = parsed.coverage_complete === true && missingDetails.length === 0;

  if (!optimizedPrompt) throw new Error(`${PROMPT_OPTIMIZER_MODEL} trả về prompt rỗng.`);

  return { optimizedPrompt, coverageComplete, missingDetails };
}

async function buildGenerationPrompt(params: {
  descriptionVi: string;
  technicalPrompt: string;
  hasReferenceImages: boolean;
  settings: VideoSettings;
}) {
  // Pass 1: lossless semantic compilation.
  const first = await requestOptimizedPrompt({
    ...params,
    targetChars: FIRST_PASS_TARGET_CHARS,
  });

  // Pass 2: always audit the candidate against BOTH original source blocks and repair omissions.
  // This intentionally costs one extra GPT-5.4 call to prioritize content fidelity over speed/cost.
  const verified = await requestOptimizedPrompt({
    ...params,
    targetChars: VERIFICATION_PASS_TARGET_CHARS,
    previousAttempt: first.optimizedPrompt,
  });

  if (!verified.coverageComplete) {
    const missing = verified.missingDetails.length ? ` Chi tiết chưa giữ được: ${verified.missingDetails.join('; ')}` : '';
    throw new Error(`${PROMPT_OPTIMIZER_MODEL} kiểm tra thấy chưa thể bảo toàn đầy đủ yêu cầu trong giới hạn prompt.${missing}`);
  }

  if (!promptFitsVideoLimit(verified.optimizedPrompt)) {
    throw new Error(
      `${PROMPT_OPTIMIZER_MODEL} đã kiểm tra prompt nhưng kết quả vẫn vượt giới hạn API video ` +
      `(${verified.optimizedPrompt.length} ký tự / ${utf8Length(verified.optimizedPrompt)} byte). Hệ thống không tự cắt nội dung để tránh mất ý.`,
    );
  }

  return verified.optimizedPrompt;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const historyId = String(body.historyId || '');
    // This is the exact user-approved Step 3 text. No GPT rewrite/optimization happens here.
    const generationPrompt = String(body.descriptionVi || '').trim();
    const referenceImages: string[] = (Array.isArray(body.referenceImages) ? body.referenceImages : [])
      .map((value: unknown) => String(value))
      .filter((url: string) => url.length > 0)
      .slice(0, 8);

    const settings: VideoSettings = {
      duration: FIXED_VIDEO_DURATION,
      ratio: String(body.ratio || '16:9'),
      resolution: body.resolution === '720P' ? '720P' : '1080P',
    };

    if (!historyId || !generationPrompt) {
      return Response.json({ error: 'Thiếu historyId hoặc prompt đã xác nhận ở Bước 3.' }, { status: 400 });
    }

<<<<<<< Updated upstream
    // GPT-5.4 performs semantic/lossless prompt compilation. No blind truncation is used.
    const generationPrompt = await buildGenerationPrompt({
      descriptionVi,
      technicalPrompt: prompt,
      hasReferenceImages: referenceImages.length > 0,
      settings,
    });
=======
    const promptBytes = utf8Length(generationPrompt);
    if (generationPrompt.length > MAX_VIDEO_PROMPT_CHARS || promptBytes > MAX_VIDEO_PROMPT_CHARS) {
      return Response.json(
        {
          error: `Prompt vượt giới hạn an toàn của API: ${generationPrompt.length.toLocaleString('vi-VN')} ký tự / ${promptBytes.toLocaleString('vi-VN')} byte UTF-8; tối đa ${MAX_VIDEO_PROMPT_CHARS.toLocaleString('vi-VN')}. Hãy quay lại Bước 3 và rút gọn nội dung.`,
          promptChars: generationPrompt.length,
          promptBytes,
          maxPromptChars: MAX_VIDEO_PROMPT_CHARS,
        },
        { status: 400 },
      );
    }
>>>>>>> Stashed changes

    const response = await shopAIKeyFetch('/v1/video/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: VIDEO_MODEL,
        prompt: generationPrompt,
        duration: FIXED_VIDEO_DURATION,
        metadata: {
          ...(referenceImages.length ? { images: referenceImages } : {}),
          duration: FIXED_VIDEO_DURATION,
          ratio: settings.ratio,
          resolution: settings.resolution,
        },
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      console.error('ShopAIKey video error', response.status, raw);
      return Response.json({ error: `${API_BRAND} · lỗi tạo video (${response.status}): ${raw.slice(0, 500)}` }, { status: 502 });
    }

    let data: any;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      console.error('ShopAIKey returned non-JSON video response', raw);
      return Response.json({ error: `${API_BRAND} trả về dữ liệu không hợp lệ: ${raw.slice(0, 300)}` }, { status: 502 });
    }

    const embeddedError =
      asNonEmptyString(data?.error?.message) ||
      asNonEmptyString(data?.error) ||
      (data?.code && String(data.code).toLowerCase() !== 'success' ? asNonEmptyString(data?.message) : '');
    if (embeddedError) {
      console.error('ShopAIKey video embedded error', data);
      return Response.json({ error: `${API_BRAND}: ${embeddedError}` }, { status: 502 });
    }

    const taskId = getTaskId(data);
    if (!taskId) {
      console.error('ShopAIKey missing task id', data);
      const rootKeys = data && typeof data === 'object' ? Object.keys(data).slice(0, 20) : [];
      const dataKeys = data?.data && typeof data.data === 'object' && !Array.isArray(data.data)
        ? Object.keys(data.data).slice(0, 20)
        : [];
      return Response.json(
        {
          error: `${API_BRAND} đã nhận request nhưng không trả về mã task. code=${asNonEmptyString(data?.code) || 'n/a'}, message=${asNonEmptyString(data?.message) || 'n/a'}.`,
          responseShape: { rootKeys, dataKeys },
        },
        { status: 502 },
      );
    }

    await attachVideoTask({ historyId, prompt: generationPrompt, taskId, settings, modelVideo: VIDEO_MODEL });

    return Response.json({
      taskId,
      status: getInitialStatus(data),
      historyId,
<<<<<<< Updated upstream
      optimizerModel: PROMPT_OPTIMIZER_MODEL,
      promptChars: generationPrompt.length,
      promptBytes: utf8Length(generationPrompt),
=======
      promptChars: generationPrompt.length,
      promptBytes,
      maxPromptChars: MAX_VIDEO_PROMPT_CHARS,
>>>>>>> Stashed changes
    });
  } catch (error) {
    console.error('video generation error', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Video generation failed' },
      { status: 500 },
    );
  }
}
