import { put } from '@vercel/blob';
import { shopAIKeyFetch } from '@/lib/shopaikey';

export const runtime = 'nodejs';
export const maxDuration = 300;

const IMAGE_MODEL = 'gpt-image-2-all';
const API_BRAND = "Mai Đức Minh'web API";
const HUMAN_IDENTITY_CONSTRAINT = 'REFERENCE IDENTITY LOCK — HIGHEST PRIORITY. Treat the uploaded reference image(s) as the authoritative identity source, not merely style inspiration. If a reference contains a person, keep the exact same person: identical face identity and facial geometry, eyes, eyebrows, nose, lips, jawline, skin tone and natural skin texture, hairstyle and hairline, apparent age, body proportions, clothing and accessories unless the user explicitly requests a change. Do not beautify, redesign, reinterpret, replace, merge, swap, morph, average, de-age, age-up, or invent the face. No identity drift, face drift, face swap or different person. The first reference image is the primary identity reference. If style or composition conflicts with identity preservation, preserve identity first.';

const RATIO_PREFIX: Record<string, string> = {
  '16:9': 'Landscape 16:9 composition',
  '9:16': 'Vertical 9:16 composition',
  '1:1': 'Square 1:1 composition',
  '4:3': 'Landscape 4:3 composition',
  '3:4': 'Vertical 3:4 composition',
  '3:2': 'Landscape 3:2 composition',
  '2:3': 'Vertical 2:3 composition',
};

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function extractImagePayload(data: any) {
  const candidates = [
    data?.data?.[0],
    Array.isArray(data?.data) ? data.data[0] : data?.data,
    data?.output?.[0],
    data?.result,
    data,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const url = asText(candidate?.url) || asText(candidate?.image_url) || asText(candidate?.imageUrl);
    const b64 = asText(candidate?.b64_json) || asText(candidate?.b64) || asText(candidate?.base64);
    if (url || b64) return { url, b64 };
  }

  return { url: '', b64: '' };
}

function decodeBase64(value: string) {
  const match = value.match(/^data:([^;]+);base64,(.+)$/s);
  if (match) {
    return { contentType: match[1] || 'image/png', buffer: Buffer.from(match[2], 'base64') };
  }
  return { contentType: 'image/png', buffer: Buffer.from(value, 'base64') };
}

async function persistImageFromBuffer(buffer: Buffer, contentType = 'image/png') {
  const extension = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : contentType.includes('webp') ? 'webp' : 'png';
  const pathname = `generated/${crypto.randomUUID()}.${extension}`;
  const blob = await put(pathname, new Blob([new Uint8Array(buffer)], { type: contentType }), {
    access: 'public',
    addRandomSuffix: false,
  });
  return blob.url;
}

async function persistUpstreamUrl(url: string) {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return url;
    const contentType = response.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await response.arrayBuffer());
    return await persistImageFromBuffer(buffer, contentType);
  } catch (error) {
    console.warn('Could not persist upstream generated image; using upstream URL', error);
    return url;
  }
}

async function buildEditForm(referenceImages: string[], prompt: string) {
  const form = new FormData();
  form.append('model', IMAGE_MODEL);
  form.append('prompt', prompt);
  form.append('response_format', 'url');

  for (let index = 0; index < referenceImages.length; index += 1) {
    const response = await fetch(referenceImages[index], { cache: 'no-store' });
    if (!response.ok) throw new Error(`Không tải được ảnh tham chiếu ${index + 1}.`);
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const blob = new Blob([await response.arrayBuffer()], { type: contentType });
    const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    form.append('image', blob, `reference-${index + 1}.${extension}`);
  }

  return form;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const prompt = String(body.prompt || '').trim();
    const descriptionVi = String(body.descriptionVi || '').trim();
    const ratio = String(body.ratio || '16:9');
    const referenceImages: string[] = (Array.isArray(body.referenceImages) ? body.referenceImages : [])
      .map((value: unknown) => String(value))
      .filter(Boolean)
      .slice(0, 4);

    if (!descriptionVi) {
      return Response.json({ error: 'Thiếu mô tả tiếng Việt đã xác nhận.' }, { status: 400 });
    }

    const generationPrompt = [
      `${RATIO_PREFIX[ratio] || RATIO_PREFIX['16:9']}.`,
      referenceImages.length ? `MANDATORY REFERENCE CONSISTENCY — APPLY BEFORE ALL STYLE INSTRUCTIONS:\n${HUMAN_IDENTITY_CONSTRAINT}` : '',
      'USER-APPROVED VIETNAMESE DIRECTION (authoritative):',
      descriptionVi,
      prompt ? `\nPRODUCTION PROMPT (use for technical detail only when compatible with identity lock and the approved Vietnamese direction):\n${prompt}` : '',
      '\nGenerate exactly one finished still image. Do not add watermarks or unrequested text/logos.',
    ].filter(Boolean).join('\n');

    const response = referenceImages.length
      ? await shopAIKeyFetch('/v1/images/edits', {
          method: 'POST',
          body: await buildEditForm(referenceImages, generationPrompt),
        })
      : await shopAIKeyFetch('/v1/images/generations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: IMAGE_MODEL,
            prompt: generationPrompt,
            response_format: 'url',
          }),
        });

    const raw = await response.text();
    if (!response.ok) {
      console.error('ShopAIKey image generation error', response.status, raw);
      return Response.json({ error: `${API_BRAND} · lỗi tạo ảnh (${response.status}): ${raw.slice(0, 500)}` }, { status: 502 });
    }

    let data: any;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      return Response.json({ error: `${API_BRAND} trả về dữ liệu ảnh không hợp lệ.` }, { status: 502 });
    }

    const embeddedError = asText(data?.error?.message) || asText(data?.error);
    if (embeddedError) {
      return Response.json({ error: `${API_BRAND}: ${embeddedError}` }, { status: 502 });
    }

    const { url, b64 } = extractImagePayload(data);
    if (!url && !b64) {
      return Response.json({ error: `${API_BRAND} đã xử lý yêu cầu nhưng không trả về ảnh.` }, { status: 502 });
    }

    const imageUrl = url
      ? await persistUpstreamUrl(url)
      : await (async () => {
          const decoded = decodeBase64(b64);
          return persistImageFromBuffer(decoded.buffer, decoded.contentType);
        })();

    return Response.json({ imageUrl, model: IMAGE_MODEL });
  } catch (error) {
    console.error('image generation error', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Image generation failed' }, { status: 500 });
  }
}
