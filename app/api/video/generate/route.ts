import { attachVideoTask } from '@/lib/db';
import { shopAIKeyFetch } from '@/lib/shopaikey';
import type { VideoSettings } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const FIXED_VIDEO_DURATION = 10;
const VIDEO_MODEL = 'grok-video-3-10s';
const API_BRAND = "Mai Đức Minh'web API";
const HUMAN_IDENTITY_CONSTRAINT = 'MANDATORY HUMAN IDENTITY CONSISTENCY: If any reference image contains a person, the person in the generated video must be the exact same person shown in the reference image(s). Preserve facial identity, facial structure, skin tone, hairstyle, age appearance, body proportions, distinctive features, clothing and accessories unless the approved Vietnamese direction explicitly requests a change. Never substitute, merge, reinterpret or beautify the person into a different identity.';

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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const historyId = String(body.historyId || '');
    const prompt = String(body.prompt || '').trim();
    const descriptionVi = String(body.descriptionVi || '').trim();
    const referenceImages: string[] = (Array.isArray(body.referenceImages) ? body.referenceImages : [])
      .map((value: unknown) => String(value))
      .filter((url: string) => url.length > 0)
      .slice(0, 8);

    const settings: VideoSettings = {
      duration: FIXED_VIDEO_DURATION,
      ratio: String(body.ratio || '16:9'),
      resolution: body.resolution === '720P' ? '720P' : '1080P',
    };

    if (!historyId || !descriptionVi) {
      return Response.json({ error: 'Missing historyId or Vietnamese description' }, { status: 400 });
    }

    const generationPrompt = [
      'USER-APPROVED VIETNAMESE DIRECTION (authoritative; follow this first):',
      descriptionVi,
      prompt
        ? `\nORIGINAL PRODUCTION PROMPT (use only for technical detail; ignore anything that conflicts with the Vietnamese direction):\n${prompt}`
        : '',
      referenceImages.length ? `\n${HUMAN_IDENTITY_CONSTRAINT}` : '',
      '\nCreate one continuous, coherent 10-second video. Preserve reference-image identity, layout, materials, logos/text and defining details unless the Vietnamese direction explicitly asks to change them.',
    ].filter(Boolean).join('\n');

    const response = await shopAIKeyFetch('/v1/video/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: VIDEO_MODEL,
        prompt: generationPrompt,
        // grok-video-3-10s is treated as a fixed 10-second preset.
        // Keep duration=10 in both supported ShopAIKey shapes for compatibility, but never accept a client override.
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

    await attachVideoTask({ historyId, prompt: descriptionVi, taskId, settings, modelVideo: VIDEO_MODEL });

    return Response.json({
      taskId,
      status: getInitialStatus(data),
      historyId,
    });
  } catch (error) {
    console.error('video generation error', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Video generation failed' },
      { status: 500 },
    );
  }
}
