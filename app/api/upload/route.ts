import { put } from '@vercel/blob';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_BYTES = 4_000_000;

function safeName(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'reference.jpg';
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return Response.json({ error: 'Missing file' }, { status: 400 });
    }
    if (!file.type.startsWith('image/')) {
      return Response.json({ error: 'Only image uploads are accepted. Videos are sampled to frames in the browser.' }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: 'Image is too large after compression. Maximum is 4 MB.' }, { status: 413 });
    }

    const pathname = `references/${crypto.randomUUID()}-${safeName(file.name)}`;
    const blob = await put(pathname, file, {
      access: 'public',
      addRandomSuffix: false,
    });

    return Response.json({
      url: blob.url,
      pathname: blob.pathname,
      contentType: file.type,
      size: file.size,
    });
  } catch (error) {
    console.error('upload error', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 },
    );
  }
}
