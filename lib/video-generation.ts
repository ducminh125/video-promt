export const VIDEO_MODEL = 'grok-video-3';
export const FIXED_VIDEO_DURATION = 10;
export const MAX_VIDEO_PROMPT_CHARS = 4096;
export const PROMPT_WARNING_CHARS = 3600;

export const VIDEO_RATIO_OPTIONS = ['16:9', '9:16', '1:1', '3:2', '2:3'] as const;
export type VideoRatio = (typeof VIDEO_RATIO_OPTIONS)[number];
export type VideoResolution = '720P' | '1080P';

export const REFERENCE_IDENTITY_LOCK = [
  'REFERENCE IMAGE IDENTITY LOCK — HIGHEST PRIORITY:',
  'Use the uploaded reference image(s) as the authoritative source for identity and appearance, not merely as style inspiration.',
  'Preserve the exact same person/people in every frame: same face identity, facial geometry and proportions, eyes, eyebrows, nose, lips, jawline, skin tone and natural skin texture, hairstyle and hairline, apparent age, body proportions, clothing and accessories.',
  'Do not beautify, redesign, reinterpret, replace, merge, swap, morph, average, de-age, age-up, or invent any face. No identity drift, face drift, facial feature drift, face swapping, or new person.',
  'Keep the same number of people. The first reference image is the primary identity reference. Maintain identity consistently through head turns, profile views, expressions, camera movement and motion blur.',
  'Animate the existing referenced subject instead of recreating the subject from scratch. If requested motion conflicts with identity preservation, reduce the motion and preserve identity first.',
].join(' ');

export function normalizeVideoRatio(value: unknown): VideoRatio {
  const candidate = String(value || '16:9') as VideoRatio;
  return VIDEO_RATIO_OPTIONS.includes(candidate) ? candidate : '16:9';
}

export function normalizeVideoResolution(value: unknown): VideoResolution {
  return value === '720P' ? '720P' : '1080P';
}

export function buildFinalVideoPrompt(input: {
  userPrompt: string;
  ratio: string;
  resolution: VideoResolution;
  hasReferenceImages: boolean;
}) {
  const ratio = normalizeVideoRatio(input.ratio);
  const resolution = normalizeVideoResolution(input.resolution);
  const sections: string[] = [];

  if (input.hasReferenceImages) {
    // Put the identity lock first so it is treated as a primary generation constraint.
    sections.push(REFERENCE_IDENTITY_LOCK);
  }

  sections.push(`USER-APPROVED SCENE DIRECTION — PRESERVE ALL REQUESTED CONTENT:\n${input.userPrompt.trim()}`);
  sections.push(
    [
      'OUTPUT FORMAT — REQUIRED:',
      `Duration: ${FIXED_VIDEO_DURATION} seconds.`,
      `Render the final video in ${ratio} aspect ratio at ${resolution}.`,
      'Adapt the composition to the selected canvas; do not stretch, squash, crop through, or distort any face or body to fit the frame.',
      'The returned video must follow the requested aspect ratio and resolution.',
    ].join(' '),
  );

  return sections.filter(Boolean).join('\n\n');
}
