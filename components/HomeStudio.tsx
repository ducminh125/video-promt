'use client';

import { useState } from 'react';
import Studio from '@/components/Studio';
import ImageStudio from '@/components/ImageStudio';

type CreatorMode = 'video' | 'image';

type SeedReference = {
  id: string;
  url: string;
  name: string;
};

export default function HomeStudio() {
  const [mode, setMode] = useState<CreatorMode>('video');
  const [seedReference, setSeedReference] = useState<SeedReference | null>(null);

  function useGeneratedImageForVideo(url: string) {
    setSeedReference({
      id: crypto.randomUUID(),
      url,
      name: 'Ảnh tạo bởi gpt-image-2-all',
    });
    setMode('video');
  }

  return (
    <>
      <div className="shell creator-mode-shell">
        <div className="creator-mode-grid" aria-label="Chọn công cụ AI">
          <button
            type="button"
            className={`creator-mode-card ${mode === 'video' ? 'active' : ''}`}
            onClick={() => setMode('video')}
          >
            <span className="creator-mode-icon">🎬</span>
            <span>
              <strong>Tạo video AI</strong>
              <small>4 bước · GPT-5.4 → Grok Video 3 · 10s</small>
            </span>
          </button>
          <button
            type="button"
            className={`creator-mode-card ${mode === 'image' ? 'active' : ''}`}
            onClick={() => setMode('image')}
          >
            <span className="creator-mode-icon">🖼️</span>
            <span>
              <strong>Tạo ảnh AI</strong>
              <small>4 bước · GPT-5.4 → gpt-image-2-all</small>
            </span>
          </button>
        </div>
      </div>

      <div hidden={mode !== 'video'}>
        <Studio
          seedReference={seedReference}
          onSeedReferenceConsumed={() => setSeedReference(null)}
        />
      </div>
      <div hidden={mode !== 'image'}>
        <ImageStudio onUseForVideo={useGeneratedImageForVideo} />
      </div>
    </>
  );
}
