'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { compressImage, extractVideoFrames, uploadReferenceImage } from '@/lib/media-client';
import type { PromptSuggestion, SourceMedia } from '@/types';

type VideoState = {
  taskId: string;
  status: string;
  progress?: string | null;
  videoUrl?: string | null;
  failReason?: string | null;
};

const MAX_FILES = 4;

type WorkflowTab = 'step-1' | 'step-23' | 'step-4';

export default function Studio() {
  const [description, setDescription] = useState('');
  const [media, setMedia] = useState<SourceMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [suggestions, setSuggestions] = useState<PromptSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [historyId, setHistoryId] = useState('');
  const [promptLoading, setPromptLoading] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoState, setVideoState] = useState<VideoState | null>(null);
  const [error, setError] = useState('');
  const [duration, setDuration] = useState(5);
  const [ratio, setRatio] = useState('16:9');
  const [resolution, setResolution] = useState<'720P' | '1080P'>('1080P');
  const [activeTab, setActiveTab] = useState<WorkflowTab>('step-1');
  const inputRef = useRef<HTMLInputElement>(null);

  function invalidateDownstream() {
    if (!suggestions.length && !historyId && !videoState) return;
    setSuggestions([]);
    setSelectedIndex(null);
    setEditedPrompt('');
    setHistoryId('');
    setVideoState(null);
  }

  const referenceImages = useMemo(
    () => media.flatMap((item) => item.referenceUrls).slice(0, 8),
    [media],
  );

  useEffect(() => {
    if (!videoState?.taskId) return;
    if (videoState.status === 'SUCCESS' || videoState.status === 'FAILURE') return;

    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/video/status/${encodeURIComponent(videoState.taskId)}`, {
          cache: 'no-store',
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Không kiểm tra được trạng thái video');
        setVideoState({
          taskId: videoState.taskId,
          status: data.status,
          progress: data.progress,
          videoUrl: data.videoUrl,
          failReason: data.failReason,
        });
      } catch (pollError) {
        console.error(pollError);
      }
    }, 7000);

    return () => window.clearInterval(timer);
  }, [videoState?.taskId, videoState?.status]);

  async function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setError('');
    invalidateDownstream();
    const incoming = Array.from(fileList).slice(0, Math.max(0, MAX_FILES - media.length));
    if (!incoming.length) {
      setError(`Tối đa ${MAX_FILES} file tham chiếu.`);
      return;
    }

    setUploading(true);
    try {
      const added: SourceMedia[] = [];
      for (const file of incoming) {
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
          throw new Error(`Không hỗ trợ định dạng ${file.type || file.name}`);
        }

        if (file.type.startsWith('image/')) {
          setUploadMessage(`Đang tối ưu ảnh: ${file.name}`);
          const compressed = await compressImage(file);
          const url = await uploadReferenceImage(compressed);
          added.push({
            id: crypto.randomUUID(),
            name: file.name,
            kind: 'image',
            previewUrl: URL.createObjectURL(file),
            referenceUrls: [url],
          });
        } else {
          setUploadMessage(`Đang lấy frame từ video: ${file.name}`);
          const frames = await extractVideoFrames(file, 4);
          const urls: string[] = [];
          for (let i = 0; i < frames.length; i++) {
            setUploadMessage(`Đang upload frame ${i + 1}/${frames.length}: ${file.name}`);
            urls.push(await uploadReferenceImage(frames[i]));
          }
          added.push({
            id: crypto.randomUUID(),
            name: file.name,
            kind: 'video',
            previewUrl: URL.createObjectURL(file),
            referenceUrls: urls,
          });
        }
      }
      setMedia((current) => [...current, ...added]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Không xử lý được file tham chiếu');
    } finally {
      setUploading(false);
      setUploadMessage('');
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function removeMedia(id: string) {
    invalidateDownstream();
    setMedia((current) => {
      const item = current.find((row) => row.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return current.filter((row) => row.id !== id);
    });
  }

  async function generatePrompts() {
    setError('');
    setPromptLoading(true);
    setSuggestions([]);
    setSelectedIndex(null);
    setEditedPrompt('');
    setVideoState(null);
    try {
      const response = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          sourceMedia: media.map(({ previewUrl: _previewUrl, ...rest }) => rest),
          referenceImages,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không tạo được prompt');
      setSuggestions(data.suggestions);
      setHistoryId(data.historyId);
      setActiveTab('step-23');
    } catch (promptError) {
      setError(promptError instanceof Error ? promptError.message : 'Không tạo được prompt');
    } finally {
      setPromptLoading(false);
    }
  }

  function choosePrompt(index: number) {
    setSelectedIndex(index);
    setEditedPrompt(suggestions[index].prompt);
    setActiveTab('step-23');
  }

  async function generateVideo() {
    if (!editedPrompt.trim() || !historyId) return;
    setError('');
    setVideoLoading(true);
    setVideoState(null);
    try {
      const response = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          historyId,
          prompt: editedPrompt,
          referenceImages,
          duration,
          ratio,
          resolution,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không tạo được tác vụ video');
      setVideoState({ taskId: data.taskId, status: data.status || 'queued', progress: '0%' });
      setActiveTab('step-4');
    } catch (videoError) {
      setError(videoError instanceof Error ? videoError.message : 'Không tạo được video');
    } finally {
      setVideoLoading(false);
    }
  }

  return (
    <main className="shell page-space">
      <section className="hero-panel">
        <div>
          <span className="eyebrow">AI VIDEO WORKFLOW</span>
          <h1>Từ ý tưởng đến video trong 4 bước</h1>
          <p>
            Miêu tả nội dung, thêm ảnh hoặc video tham chiếu, nhận 3 prompt từ GPT-5.4 rồi tạo video bằng Grok Video 3.
          </p>
        </div>
        <div className="hero-badge">
          <strong>ShopAIKey</strong>
          <span>Server-side API</span>
        </div>
      </section>

      {error ? <div className="alert error-alert">{error}</div> : null}

      <nav className="workflow-tabs" aria-label="Các bước tạo video">
        <button
          type="button"
          className={`workflow-tab ${activeTab === 'step-1' ? 'active' : ''}`}
          onClick={() => setActiveTab('step-1')}
        >
          <span className="workflow-tab-number">1</span>
          <span className="workflow-tab-copy">
            <strong>Bước 1</strong>
            <small>Ý tưởng & tham chiếu</small>
          </span>
        </button>
        <button
          type="button"
          className={`workflow-tab ${activeTab === 'step-23' ? 'active' : ''}`}
          onClick={() => setActiveTab('step-23')}
        >
          <span className="workflow-tab-number">2–3</span>
          <span className="workflow-tab-copy">
            <strong>Bước 2–3</strong>
            <small>{suggestions.length ? 'Chọn & chỉnh prompt' : 'Chờ prompt từ bước 1'}</small>
          </span>
        </button>
        <button
          type="button"
          className={`workflow-tab ${activeTab === 'step-4' ? 'active' : ''}`}
          onClick={() => setActiveTab('step-4')}
        >
          <span className="workflow-tab-number">4</span>
          <span className="workflow-tab-copy">
            <strong>Bước 4</strong>
            <small>
              {videoState
                ? videoState.status.toUpperCase() === 'SUCCESS'
                  ? 'Video đã hoàn thành'
                  : videoState.status.toUpperCase() === 'FAILURE'
                    ? 'Tạo video thất bại'
                    : 'Video đang được tạo'
                : 'Tạo & theo dõi video'}
            </small>
          </span>
          {videoState && videoState.status.toUpperCase() !== 'SUCCESS' && videoState.status.toUpperCase() !== 'FAILURE' ? (
            <span className="tab-live-dot" aria-label="Video đang được tạo" />
          ) : null}
        </button>
      </nav>

      {activeTab === 'step-1' ? (
      <section className="step-card" id="step-1">
        <div className="step-head">
          <span className="step-number">1</span>
          <div>
            <h2>Miêu tả nội dung</h2>
            <p>Nêu rõ chủ thể, hành động, bối cảnh, phong cách, camera và điều cần giữ nguyên.</p>
          </div>
        </div>

        <textarea
          className="large-textarea"
          value={description}
          onChange={(event) => {
            invalidateDownstream();
            setDescription(event.target.value);
          }}
          placeholder="Ví dụ: Tạo video kiến trúc photorealistic, giữ nguyên hình khối công trình và vật liệu, camera dolly chậm từ trái sang phải, ánh sáng chiều trong trẻo..."
          rows={7}
        />

        <div className="upload-zone" onClick={() => inputRef.current?.click()}>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={(event) => addFiles(event.target.files)}
          />
          <strong>{uploading ? 'Đang xử lý media…' : 'Thêm ảnh hoặc video minh họa'}</strong>
          <span>
            Ảnh được nén trước khi upload. Video được lấy 4 frame ngay trên trình duyệt; file video gốc không được tải lên server.
          </span>
          {uploadMessage ? <em>{uploadMessage}</em> : null}
        </div>

        {media.length ? (
          <div className="media-grid">
            {media.map((item) => (
              <article className="media-card" key={item.id}>
                {item.kind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.previewUrl} alt={item.name} />
                ) : (
                  <video src={item.previewUrl} muted controls preload="metadata" />
                )}
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.kind === 'video' ? `${item.referenceUrls.length} frame tham chiếu` : 'Ảnh tham chiếu'}</span>
                </div>
                <button type="button" className="text-button danger" onClick={() => removeMedia(item.id)}>
                  Xóa
                </button>
              </article>
            ))}
          </div>
        ) : null}

        <div className="actions-row">
          <span className="muted">{referenceImages.length} ảnh/frame sẽ được gửi cho GPT-5.4 và Grok Video 3.</span>
          <button
            className="primary-button"
            onClick={generatePrompts}
            disabled={promptLoading || uploading || description.trim().length < 10}
          >
            {promptLoading ? 'GPT-5.4 đang tạo 3 prompt…' : 'Tạo 3 gợi ý prompt'}
          </button>
        </div>
      </section>
      ) : null}

      {activeTab === 'step-23' ? (
      <div className="tab-step-stack">
      <section className="step-card" id="step-2">
        <div className="step-head">
          <span className="step-number">2</span>
          <div>
            <h2>Chọn một prompt</h2>
            <p>Mỗi phương án có mô tả tiếng Việt chi tiết để bạn hình dung cảnh quay trước khi chọn; prompt tiếng Anh vẫn có thể mở ra để xem đầy đủ.</p>
          </div>
        </div>

        {!suggestions.length ? (
          <div className="empty-state">Prompt sẽ xuất hiện tại đây sau khi hoàn thành bước 1.</div>
        ) : (
          <div className="prompt-grid">
            {suggestions.map((item, index) => (
              <article className={`prompt-card ${selectedIndex === index ? 'selected' : ''}`} key={`${item.title}-${index}`}>
                <div className="prompt-topline">
                  <span>Phương án {index + 1}</span>
                  <strong>{item.title}</strong>
                </div>
                <div className="prompt-description-vi">
                  <span>Mô tả tiếng Việt</span>
                  <p>{item.descriptionVi || item.why}</p>
                </div>
                <details className="prompt-english-details">
                  <summary>Xem prompt tiếng Anh gửi cho AI</summary>
                  <p className="prompt-body">{item.prompt}</p>
                </details>
                {item.why ? (
                  <p className="prompt-why"><strong>Điểm nổi bật:</strong> {item.why}</p>
                ) : null}
                <button className="secondary-button" type="button" onClick={() => choosePrompt(index)}>
                  {selectedIndex === index ? 'Đã chọn' : 'Chọn prompt này'}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="step-card" id="step-3">
        <div className="step-head">
          <span className="step-number">3</span>
          <div>
            <h2>Chỉnh sửa prompt</h2>
            <p>Bạn có thể sửa trực tiếp trước khi gửi sang Grok Video 3.</p>
          </div>
        </div>
        <textarea
          className="large-textarea prompt-editor"
          value={editedPrompt}
          onChange={(event) => setEditedPrompt(event.target.value)}
          rows={11}
          placeholder="Chọn một prompt ở bước 2 để chỉnh sửa."
          disabled={selectedIndex === null}
        />
      </section>
      </div>
      ) : null}

      {activeTab === 'step-4' ? (
      <section className="step-card" id="step-4">
        <div className="step-head">
          <span className="step-number">4</span>
          <div>
            <h2>Tạo video bằng Grok Video 3</h2>
            <p>Thiết lập đầu ra, gửi task và tự động kiểm tra trạng thái mỗi 7 giây.</p>
          </div>
        </div>

        <div className="settings-grid">
          <label>
            <span>Thời lượng (giây)</span>
            <input type="number" min={1} max={30} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </label>
          <label>
            <span>Tỉ lệ</span>
            <select value={ratio} onChange={(e) => setRatio(e.target.value)}>
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
              <option value="1:1">1:1</option>
              <option value="3:2">3:2</option>
              <option value="2:3">2:3</option>
            </select>
          </label>
          <label>
            <span>Độ phân giải</span>
            <select value={resolution} onChange={(e) => setResolution(e.target.value as '720P' | '1080P')}>
              <option value="1080P">1080P</option>
              <option value="720P">720P</option>
            </select>
          </label>
        </div>

        <button
          className="primary-button full-button"
          onClick={generateVideo}
          disabled={videoLoading || !editedPrompt.trim() || !historyId}
        >
          {videoLoading ? 'Đang gửi tác vụ…' : 'Tạo video với grok-video-3'}
        </button>

        {videoState && videoState.status.toUpperCase() !== 'SUCCESS' && videoState.status.toUpperCase() !== 'FAILURE' ? (
          <div className="video-creating-notice" role="status" aria-live="polite">
            <span className="video-creating-spinner" aria-hidden="true" />
            <div>
              <strong>Đã ghi nhận yêu cầu tạo video</strong>
              <p>Video đang được tạo. Bạn có thể ở lại tab này để theo dõi; trạng thái sẽ tự động cập nhật mỗi 7 giây.</p>
            </div>
          </div>
        ) : null}

        {videoState ? (
          <div className="result-panel">
            <div className="result-status-row">
              <div>
                <span className={`status-pill status-${videoState.status.toLowerCase()}`}>{videoState.status}</span>
                <strong>{videoState.progress || 'Đang chờ cập nhật'}</strong>
              </div>
              <code>{videoState.taskId}</code>
            </div>

            {videoState.status === 'SUCCESS' && videoState.videoUrl ? (
              <div className="video-result">
                <div className="history-saved-note">
                  <strong>Video đã được ghi vào lịch sử</strong>
                  <span>Lịch sử chỉ hiển thị prompt bạn đã chọn để tạo video này.</span>
                </div>
                <video controls src={videoState.videoUrl} preload="metadata" />
                <div className="video-result-actions">
                  <a className="secondary-button link-button" href={videoState.videoUrl} target="_blank" rel="noreferrer">
                    Mở video gốc
                  </a>
                  <a className="secondary-button link-button" href="/history">
                    Xem trong lịch sử
                  </a>
                </div>
              </div>
            ) : null}

            {videoState.status === 'FAILURE' ? (
              <div className="alert error-alert">{videoState.failReason || 'Tác vụ tạo video thất bại.'}</div>
            ) : null}
          </div>
        ) : null}
      </section>
      ) : null}
    </main>
  );
}
