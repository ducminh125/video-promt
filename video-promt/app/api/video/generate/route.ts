import { attachVideoTask } from '@/lib/db';
import { shopAIKeyFetch } from '@/lib/shopaikey';
import type { VideoSettings } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const historyId = String(body.historyId || '');
    const prompt = String(body.prompt || '').trim();
    const referenceImages = (Array.isArray(body.referenceImages) ? body.referenceImages : [])
      .map(String)
      .filter(Boolean)
      .slice(0, 8);

    const settings: VideoSettings = {
      duration: Math.max(1, Math.min(30, Number(body.duration) || 5)),
      ratio: String(body.ratio || '16:9'),
      resolution: body.resolution === '720P' ? '720P' : '1080P',
    };

    if (!historyId || !prompt) {
      return Response.json({ error: 'Missing historyId or prompt' }, { status: 400 });
    }

    const response = await shopAIKeyFetch('/v1/video/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'grok-video-3',
        prompt,
        metadata: {
          ...(referenceImages.length ? { images: referenceImages } : {}),
          duration: settings.duration,
          ratio: settings.ratio,
          resolution: settings.resolution,
        },
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      console.error('ShopAIKey video error', response.status, raw);
      return Response.json({ error: `ShopAIKey video error (${response.status}): ${raw.slice(0, 500)}` }, { status: 502 });
    }

    const data = JSON.parse(raw);
    const taskId = data?.data?.task_id;
    if (!taskId) {
      return Response.json({ error: 'ShopAIKey did not return task_id', raw: data }, { status: 502 });
    }

    await attachVideoTask({ historyId, prompt, taskId, settings });

    return Response.json({
      taskId,
      status: data?.data?.status || 'queued',
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
