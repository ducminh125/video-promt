function canvasToFile(canvas: HTMLCanvasElement, name: string, quality = 0.86) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Could not encode image'));
        resolve(new File([blob], name, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      quality,
    );
  });
}

export async function compressImage(file: File, maxDimension = 1600) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const base = file.name.replace(/\.[^.]+$/, '') || 'reference';
  return canvasToFile(canvas, `${base}.jpg`);
}

function waitForEvent(target: EventTarget, event: string) {
  return new Promise<void>((resolve, reject) => {
    const onDone = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Failed while waiting for ${event}`));
    };
    const cleanup = () => {
      target.removeEventListener(event, onDone);
      target.removeEventListener('error', onError);
    };
    target.addEventListener(event, onDone, { once: true });
    target.addEventListener('error', onError, { once: true });
  });
}

export async function extractVideoFrames(file: File, frameCount = 4) {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;
  video.src = objectUrl;

  try {
    if (video.readyState < 1) await waitForEvent(video, 'loadedmetadata');
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    const times = Array.from({ length: frameCount }, (_, i) => ((i + 1) / (frameCount + 1)) * duration);
    const files: File[] = [];

    for (let i = 0; i < times.length; i++) {
      video.currentTime = Math.max(0.01, Math.min(times[i], Math.max(0.01, duration - 0.01)));
      await waitForEvent(video, 'seeked');

      const maxDimension = 1280;
      const scale = Math.min(1, maxDimension / Math.max(video.videoWidth || 1, video.videoHeight || 1));
      const width = Math.max(1, Math.round((video.videoWidth || 1) * scale));
      const height = Math.max(1, Math.round((video.videoHeight || 1) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is not available');
      ctx.drawImage(video, 0, 0, width, height);
      const base = file.name.replace(/\.[^.]+$/, '') || 'video';
      files.push(await canvasToFile(canvas, `${base}-frame-${i + 1}.jpg`, 0.84));
    }

    return files;
  } finally {
    URL.revokeObjectURL(objectUrl);
    video.removeAttribute('src');
    video.load();
  }
}

export async function uploadReferenceImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch('/api/upload', { method: 'POST', body: formData });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Upload failed');
  return String(data.url);
}
