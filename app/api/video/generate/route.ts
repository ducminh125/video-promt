import { attachVideoTask } from '@/lib/db';
import { shopAIKeyFetch } from '@/lib/shopaikey';
import type { VideoSettings } from '@/types';
import {
  buildFinalVideoPrompt,
  FIXED_VIDEO_DURATION,
  MAX_VIDEO_PROMPT_CHARS,
  normalizeVideoRatio,
  normalizeVideoResolution,
  VIDEO_MODEL,
} from '@/lib/video-generation';

export const runtime = 'nodejs';
export const maxDuration = 60;

const API_BRAND = "Mai Đức Minh'web API";

function utf8Length(value: string) {
  return Buffer.byteLength(value, 'utf8');
}

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
    // The Step 3 text stays untouched. We only append deterministic technical constraints below.
    const approvedPrompt = String(body.descriptionVi || '').trim();
    const referenceImages: string[] = (Array.isArray(body.referenceImages) ? body.referenceImages : [])
      .map((value: unknown) => String(value))
      .filter((url: string) => url.length > 0)
      .slice(0, 8);

    const settings: VideoSettings = {
      duration: FIXED_VIDEO_DURATION,
      ratio: normalizeVideoRatio(body.ratio),
      resolution: normalizeVideoResolution(body.resolution),
    };

    if (!historyId || !approvedPrompt) {
      return Response.json({ error: 'Thiếu historyId hoặc prompt đã xác nhận ở Bước 3.' }, { status: 400 });
    }

    const generationPrompt = buildFinalVideoPrompt({
      userPrompt: approvedPrompt,
      ratio: settings.ratio,
      resolution: settings.resolution,
      hasReferenceImages: referenceImages.length > 0,
    });

    const promptBytes = utf8Length(generationPrompt);
    if (generationPrompt.length > MAX_VIDEO_PROMPT_CHARS || promptBytes > MAX_VIDEO_PROMPT_CHARS) {
      return Response.json(
        {
          error: `Prompt vượt giới hạn an toàn của API: ${generationPrompt.length.toLocaleString('vi-VN')} ký tự / ${promptBytes.toLocaleString('vi-VN')} byte UTF-8; tối đa ${MAX_VIDEO_PROMPT_CHARS.toLocaleString('vi-VN')}. Hãy quay lại Bước 3 và rút gọn nội dung.`,
          promptChars: generationPrompt.length,
          promptBytes,
          maxPromptChars: MAX_VIDEO_PROMPT_CHARS,
          settings,
          model: VIDEO_MODEL,
          referenceImageCount: referenceImages.length,
        },
        { status: 400 },
      );
    }

    console.info('Video generation request', {
      model: VIDEO_MODEL,
      promptChars: generationPrompt.length,
      promptBytes,
      referenceImageCount: referenceImages.length,
      metadata: settings,
    });

    const response = await shopAIKeyFetch('/v1/video/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: VIDEO_MODEL,
        prompt: generationPrompt,
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

    // Keep history human-readable: store the exact Step 3 text, not the appended technical guard.
    await attachVideoTask({ historyId, prompt: approvedPrompt, taskId, settings, modelVideo: VIDEO_MODEL });

    return Response.json({
      taskId,
      status: getInitialStatus(data),
      historyId,
      promptChars: generationPrompt.length,
      promptBytes,
      maxPromptChars: MAX_VIDEO_PROMPT_CHARS,
      settings,
      model: VIDEO_MODEL,
      referenceImageCount: referenceImages.length,
    });
  } catch (error) {
    console.error('video generation error', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Video generation failed' },
      { status: 500 },
    );
  }
}
