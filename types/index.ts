export type PromptSuggestion = {
  title: string;
  prompt: string;
  descriptionVi: string;
  why: string;
};

export type SourceMedia = {
  id: string;
  name: string;
  kind: 'image' | 'video';
  previewUrl?: string;
  referenceUrls: string[];
};

export type VideoSettings = {
  duration: number;
  ratio: string;
  resolution: '720P' | '1080P';
};

export type HistoryItem = {
  id: string;
  description: string;
  prompt_options: PromptSuggestion[];
  selected_prompt: string | null;
  source_media: SourceMedia[];
  reference_images: string[];
  model_text: string;
  model_video: string;
  task_id: string | null;
  status: string;
  progress: string | null;
  video_url: string | null;
  fail_reason: string | null;
  settings: Partial<VideoSettings>;
  created_at: string;
  updated_at: string;
};


export type ImageHistoryItem = {
  id: string;
  description: string;
  production_prompt: string | null;
  reference_images: string[];
  image_url: string;
  ratio: string;
  model_image: string;
  created_at: string;
};
