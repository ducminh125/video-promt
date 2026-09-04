'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { compressImage, extractVideoFrames, uploadReferenceImage } from '@/lib/media-client';
import type { PromptSuggestion, SourceMedia } from '@/types';
import {
  buildFinalVideoPrompt,
  FIXED_VIDEO_DURATION,
  MAX_VIDEO_PROMPT_CHARS,
  PROMPT_WARNING_CHARS,
  VIDEO_MODEL,
} from '@/lib/video-generation';

type VideoState = {
  taskId: string;
  status: string;
  progress?: string | null;
  videoUrl?: string | null;
  failReason?: string | null;
};

const MAX_FILES = 4;

type WorkflowTab = 'step-1' | 'step-2' | 'step-3' | 'step-4';

type StudioProps = {
  seedReference?: { id: string; url: string; name?: string } | null;
  onSeedReferenceConsumed?: () => void;
};

export default function Studio({ seedReference, onSeedReferenceConsumed }: StudioProps = {}) {
  const [description, setDescription] = useState('');
  const [media, setMedia] = useState<SourceMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [suggestions, setSuggestions] = useState<PromptSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [editedDescriptionVi, setEditedDescriptionVi] = useState('');
  const [historyId, setHistoryId] = useState('');
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptWaitSeconds, setPromptWaitSeconds] = useState(0);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoState, setVideoState] = useState<VideoState | null>(null);
  const [videoOutputMeta, setVideoOutputMeta] = useState<{ width: number; height: number; duration: number } | null>(null);
  const [error, setError] = useState('');
  const duration = FIXED_VIDEO_DURATION;
  const [ratio, setRatio] = useState('16:9');
  const [resolution, setResolution] = useState<'720P' | '1080P'>('1080P');
  const [activeTab, setActiveTab] = useState<WorkflowTab>('step-1');
  const [promptConfirmed, setPromptConfirmed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const promptEnhancements: Array<{ id: string; label: string; options: Array<[string, string, string]> }> = [
    {
      id: 'camera',
      label: '🎥 Chuyển động camera',
      options: [
        ['slow-dolly', 'Slow dolly điện ảnh', 'Chuyển động camera: slow dolly in/out mượt, chuyển động ổn định, góc quay điện ảnh.'],
        ['tracking', 'Tracking theo chủ thể', 'Chuyển động camera: tracking shot bám theo chủ thể, giữ chủ thể ổn định trong khung hình.'],
        ['pan-tilt', 'Pan / tilt nhẹ', 'Chuyển động camera: pan hoặc tilt chậm, tự nhiên, không rung giật.'],
        ['static', 'Máy quay tĩnh', 'Chuyển động camera: khung hình cố định, máy quay tĩnh, ưu tiên chuyển động của chủ thể.'],
      ],
    },
    {
      id: 'character',
      label: '🧍 Phong cách nhân vật',
      options: [
        ['natural', 'Tự nhiên, chân thực', 'Phong cách nhân vật: ngoại hình tự nhiên, biểu cảm rõ ràng, chuyển động chân thực.'],
        ['cinematic', 'Điện ảnh', 'Phong cách nhân vật: cinematic realism, biểu cảm tinh tế, chuyển động có chủ đích như phim điện ảnh.'],
        ['commercial', 'Quảng cáo cao cấp', 'Phong cách nhân vật: chỉn chu như TVC cao cấp, chuyển động sạch, biểu cảm tự tin và chuyên nghiệp.'],
      ],
    },
    {
      id: 'environment',
      label: '🌄 Khung cảnh xung quanh',
      options: [
        ['preserve', 'Giữ nguyên ảnh tham chiếu', 'Khung cảnh: giữ nguyên bố cục và các chi tiết quan trọng của ảnh tham chiếu, chỉ tạo chuyển động tự nhiên.'],
        ['depth', 'Có chiều sâu điện ảnh', 'Khung cảnh: môi trường có chiều sâu không gian rõ, tiền cảnh/trung cảnh/hậu cảnh tự nhiên và giàu chi tiết.'],
        ['clean', 'Tối giản, sạch', 'Khung cảnh: gọn gàng, ít chi tiết gây nhiễu, tập trung mạnh vào chủ thể chính.'],
      ],
    },
    {
      id: 'lighting',
      label: '💡 Ánh sáng & màu sắc',
      options: [
        ['cinematic', 'Cinematic', 'Ánh sáng & màu sắc: cinematic lighting, tương phản tự nhiên, màu hài hòa và giàu chiều sâu.'],
        ['daylight', 'Ánh sáng tự nhiên', 'Ánh sáng & màu sắc: natural daylight, màu trung thực, da và vật liệu giữ texture tự nhiên.'],
        ['warm', 'Ấm áp', 'Ánh sáng & màu sắc: ánh sáng vàng ấm, mood dễ chịu, highlight mềm và màu sắc hài hòa.'],
        ['cool', 'Lạnh hiện đại', 'Ánh sáng & màu sắc: tông lạnh hiện đại, sạch, tương phản vừa phải, cảm giác công nghệ/cao cấp.'],
      ],
    },
    {
      id: 'voice',
      label: '🎙️ Giọng nói / thoại',
      options: [
        ['none', 'Không thêm thoại', 'Giọng nói / thoại: không tự tạo thêm câu thoại hoặc giọng nói nếu mô tả chính không yêu cầu.'],
        ['vietnamese', 'Thoại tiếng Việt tự nhiên', 'Giọng nói / thoại: tiếng Việt tự nhiên, rõ lời, cảm xúc phù hợp và khớp khẩu hình. Giữ nguyên chính xác câu thoại nếu người dùng đã viết trong mô tả chính.'],
        ['voiceover', 'Voice-over tiếng Việt', 'Giọng nói / thoại: voice-over tiếng Việt rõ ràng, nhịp nói tự nhiên, cảm xúc phù hợp; không bắt buộc khớp khẩu hình.'],
      ],
    },
    {
      id: 'video-style',
      label: '🎬 Phong cách video',
      options: [
        ['realistic', 'Chân thực', 'Phong cách video: photorealistic, high detail, chuyển động vật lý tự nhiên.'],
        ['cinematic', 'Điện ảnh', 'Phong cách video: cinematic, realistic, high detail, nhịp chuyển động như phim chuyên nghiệp.'],
        ['premium', 'Quảng cáo cao cấp', 'Phong cách video: premium commercial, hình ảnh sạch, sang trọng, chi tiết vật liệu rõ và chuyển động tinh tế.'],
      ],
    },
  ];

  const [enhancementSelections, setEnhancementSelections] = useState<Record<string, string>>({});

  const referenceImages = useMemo(
    () => media.flatMap((item) => item.referenceUrls).slice(0, 8),
    [media],
  );

  const combinedDescription = useMemo(() => {
    const selectedDetails = promptEnhancements.flatMap((group) => {
      const selectedValue = enhancementSelections[group.id];
      const option = group.options.find(([value]) => value === selectedValue);
      return option ? [option[2]] : [];
    });
    return [description.trim(), ...selectedDetails].filter(Boolean).join('\n');
  }, [description, enhancementSelections]);

  const videoPrompt = editedDescriptionVi.trim();
  const userPromptCharCount = videoPrompt.length;
  const finalVideoPrompt = useMemo(() => buildFinalVideoPrompt({
    userPrompt: videoPrompt,
    ratio,
    resolution,
    hasReferenceImages: referenceImages.length > 0,
  }), [videoPrompt, ratio, resolution, referenceImages.length]);
  const videoPromptCharCount = finalVideoPrompt.length;
  const videoPromptByteCount = new TextEncoder().encode(finalVideoPrompt).length;
  const videoPromptCharsRemaining = MAX_VIDEO_PROMPT_CHARS - videoPromptCharCount;
  const videoPromptBytesRemaining = MAX_VIDEO_PROMPT_CHARS - videoPromptByteCount;
  const videoPromptLimitUsage = Math.max(videoPromptCharCount, videoPromptByteCount);
  const videoPromptTooLong = videoPromptCharCount > MAX_VIDEO_PROMPT_CHARS || videoPromptByteCount > MAX_VIDEO_PROMPT_CHARS;
  const videoPromptNearLimit = !videoPromptTooLong && videoPromptLimitUsage >= PROMPT_WARNING_CHARS;

  function setEnhancement(groupId: string, value: string) {
    invalidateDownstream();
    setEnhancementSelections((current) => ({ ...current, [groupId]: value }));
  }

  function invalidateDownstream() {
    if (!suggestions.length && !historyId && !videoState) return;
    setSuggestions([]);
    setSelectedIndex(null);
    setEditedDescriptionVi('');
    setHistoryId('');
    setVideoState(null);
    setPromptConfirmed(false);
  }

  useEffect(() => {
    if (!seedReference?.url) return;
    invalidateDownstream();
    setMedia((current) => {
      if (current.some((item) => item.id === seedReference.id || item.referenceUrls.includes(seedReference.url))) return current;
      const generatedReference: SourceMedia = {
        id: seedReference.id,
        name: seedReference.name || 'Ảnh tạo bởi AI',
        kind: 'image',
        previewUrl: seedReference.url,
        referenceUrls: [seedReference.url],
      };
      return [...current.slice(0, MAX_FILES - 1), generatedReference];
    });
    setActiveTab('step-1');
    onSeedReferenceConsumed?.();
    // The seed is a one-shot handoff from the image workflow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedReference?.id]);


  useEffect(() => {
    if (!promptLoading) {
      setPromptWaitSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setPromptWaitSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [promptLoading]);

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
      if (item?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl);
      return current.filter((row) => row.id !== id);
    });
  }

  async function generatePrompts() {
    setError('');
    setPromptLoading(true);
    setSuggestions([]);
    setSelectedIndex(null);
    setEditedDescriptionVi('');
    setVideoState(null);
    setPromptConfirmed(false);
    try {
      const response = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: combinedDescription,
          sourceMedia: media.map(({ previewUrl: _previewUrl, ...rest }) => rest),
          referenceImages,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không tạo được prompt');
      setSuggestions(data.suggestions);
      setHistoryId(data.historyId);
      setActiveTab('step-2');
    } catch (promptError) {
      setError(promptError instanceof Error ? promptError.message : 'Không tạo được prompt');
    } finally {
      setPromptLoading(false);
    }
  }

  function choosePrompt(index: number) {
    setSelectedIndex(index);
    setEditedDescriptionVi(suggestions[index].descriptionVi || suggestions[index].why || '');
    setPromptConfirmed(false);
    setError('');
    setActiveTab('step-3');
  }

  function confirmPrompt() {
    if (selectedIndex === null || !videoPrompt) {
      setError('Hãy chọn và điều chỉnh mô tả tiếng Việt trước khi xác nhận.');
      return;
    }
    if (videoPromptTooLong) {
      setError(`Prompt đang vượt giới hạn an toàn của API (${videoPromptCharCount.toLocaleString('vi-VN')} ký tự / ${videoPromptByteCount.toLocaleString('vi-VN')} byte UTF-8). Hãy rút gọn trước khi sang Bước 4.`);
      return;
    }
    setError('');
    setPromptConfirmed(true);
    setActiveTab('step-4');
  }

  async function generateVideo() {
    if (!videoPrompt || !historyId || !promptConfirmed) {
      setError('Hãy xác nhận mô tả tiếng Việt ở Bước 3 trước khi tạo video.');
      return;
    }
    if (videoPromptTooLong) {
      setError(`Prompt vượt giới hạn an toàn của API. Hãy quay lại Bước 3 và rút gọn nội dung.`);
      setActiveTab('step-3');
      return;
    }
    setError('');
    setVideoLoading(true);
    setVideoState(null);
    setVideoOutputMeta(null);
    try {
      const response = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          historyId,
          descriptionVi: videoPrompt,
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
            Miêu tả nội dung, thêm ảnh hoặc video tham chiếu, nhận 3 phương án từ GPT-5.4 rồi tạo video 10 giây bằng Grok Video 3.
          </p>
        </div>
        <div className="hero-badge">
          <strong>Mai Đức Minh&apos;web</strong>
          <span>AI API</span>
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
          className={`workflow-tab ${activeTab === 'step-2' ? 'active' : ''}`}
          onClick={() => setActiveTab('step-2')}
          disabled={!suggestions.length}
        >
          <span className="workflow-tab-number">2</span>
          <span className="workflow-tab-copy">
            <strong>Bước 2</strong>
            <small>{suggestions.length ? 'Chọn 1 trong 3 prompt' : 'Chờ prompt từ bước 1'}</small>
          </span>
        </button>
        <button
          type="button"
          className={`workflow-tab ${activeTab === 'step-3' ? 'active' : ''}`}
          onClick={() => setActiveTab('step-3')}
          disabled={selectedIndex === null}
        >
          <span className="workflow-tab-number">3</span>
          <span className="workflow-tab-copy">
            <strong>Bước 3</strong>
            <small>{selectedIndex !== null ? (promptConfirmed ? 'Mô tả đã xác nhận' : 'Điều chỉnh mô tả tiếng Việt') : 'Chưa chọn phương án'}</small>
          </span>
        </button>
        <button
          type="button"
          className={`workflow-tab ${activeTab === 'step-4' ? 'active' : ''}`}
          onClick={() => setActiveTab('step-4')}
          disabled={!promptConfirmed && !videoState}
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
                : promptConfirmed
                  ? 'Sẵn sàng tạo video'
                  : 'Chờ xác nhận ở bước 3'}
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
            <p>Nêu rõ chủ thể, hành động, bối cảnh, phong cách, camera, giọng nói/thoại và điều cần giữ nguyên.</p>
          </div>
        </div>

        <div className="enhancement-panel">
          <div className="enhancement-panel-head">
            <strong>Tùy chọn bổ sung</strong>
            <span>Các lựa chọn bên dưới sẽ được ghép cùng mô tả khi tạo prompt, không chèn thêm chữ vào ô mô tả.</span>
          </div>
          <div className="enhancement-grid">
            {promptEnhancements.map((group) => (
              <label className="enhancement-field" key={group.id}>
                <span>{group.label}</span>
                <select value={enhancementSelections[group.id] || ''} onChange={(event) => setEnhancement(group.id, event.target.value)}>
                  <option value="">Không chọn</option>
                  {group.options.map(([value, label]) => (
                    <option value={value} key={value}>{label}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>

        <textarea
          className="large-textarea"
          value={description}
          onChange={(event) => {
            invalidateDownstream();
            setDescription(event.target.value);
          }}
          placeholder="Ví dụ: Tạo video photorealistic, giữ nguyên nhân vật theo ảnh tham chiếu, camera dolly chậm, ánh sáng điện ảnh; nếu có thoại hãy nêu ngôn ngữ, chất giọng, cảm xúc và tốc độ nói..."
          rows={7}
        />

        {Object.values(enhancementSelections).some(Boolean) ? (
          <details className="combined-description-preview">
            <summary>Xem nội dung đầy đủ sẽ gửi cho AI</summary>
            <p>{combinedDescription}</p>
          </details>
        ) : null}

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
          <span className="muted">{referenceImages.length} ảnh/frame sẽ được gửi cho GPT-5.4 và Grok Video 3 (10s).</span>
          <button
            className="primary-button"
            onClick={generatePrompts}
            disabled={promptLoading || uploading || combinedDescription.trim().length < 10}
          >
            {promptLoading ? 'GPT-5.4 đang tạo 3 prompt…' : 'Tạo 3 gợi ý prompt'}
          </button>
        </div>

        {promptLoading ? (
          <div className="prompt-waiting-panel" role="status" aria-live="polite">
            <span className="prompt-waiting-spinner" aria-hidden="true" />
            <div className="prompt-waiting-content">
              <div className="prompt-waiting-title">
                <strong>Hệ thống đang xử lý — không bị treo</strong>
                <span>{promptWaitSeconds}s</span>
              </div>
              <p>GPT-5.4 đang đọc mô tả và ảnh/frame tham chiếu để xây dựng 3 phương án video. Vui lòng giữ trang này mở cho đến khi tự động chuyển sang Bước 2.</p>
              <div className="prompt-waiting-progress" aria-hidden="true"><span /></div>
              <div className="prompt-waiting-steps">
                <span className="active">Phân tích yêu cầu</span>
                <span className={promptWaitSeconds >= 4 ? 'active' : ''}>Dựng 3 phương án</span>
                <span className={promptWaitSeconds >= 9 ? 'active' : ''}>Hoàn thiện mô tả tiếng Việt</span>
              </div>
            </div>
          </div>
        ) : null}

      </section>
      ) : null}

      {activeTab === 'step-2' ? (
      <section className="step-card" id="step-2">
        <div className="step-head">
          <span className="step-number">2</span>
          <div>
            <h2>Chọn một prompt</h2>
            <p>Mỗi phương án có mô tả tiếng Việt chi tiết để bạn hình dung cảnh quay trước khi chọn.</p>
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
                  <summary>Xem prompt kỹ thuật tiếng Anh tham khảo</summary>
                  <p className="prompt-body">{item.prompt}</p>
                </details>
                {item.why ? (
                  <p className="prompt-why"><strong>Điểm nổi bật:</strong> {item.why}</p>
                ) : null}
                <button className="secondary-button" type="button" onClick={() => choosePrompt(index)}>
                  {selectedIndex === index ? 'Chọn lại / chỉnh sửa' : 'Chọn prompt này'}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
      ) : null}

      {activeTab === 'step-3' ? (
      <section className="step-card" id="step-3">
        <div className="step-head">
          <span className="step-number">3</span>
          <div>
            <h2>Điều chỉnh prompt & kiểm tra giới hạn ký tự</h2>
            <p>Mô tả của bạn được giữ nguyên. Hệ thống chỉ bổ sung tự động khóa nhận diện ảnh tham chiếu và yêu cầu đầu ra trước khi gửi Grok Video 3. Bộ đếm dưới đây tính theo prompt thực tế sau khi bổ sung; giới hạn tối đa 4.096.</p>
          </div>
        </div>

        {selectedIndex !== null ? (
          <div className="confirmed-choice-summary">
            <span>Phương án đang chọn</span>
            <strong>Phương án {selectedIndex + 1}: {suggestions[selectedIndex]?.title}</strong>
            <p>{suggestions[selectedIndex]?.descriptionVi || suggestions[selectedIndex]?.why}</p>
          </div>
        ) : null}

        <textarea
          className="large-textarea prompt-editor"
          value={editedDescriptionVi}
          onChange={(event) => {
            setEditedDescriptionVi(event.target.value);
            setPromptConfirmed(false);
          }}
          rows={11}
          placeholder="Ví dụ: Giữ nguyên khuôn mặt và trang phục. Nhân vật bước chậm về phía camera, máy quay dolly lùi nhẹ, ánh sáng vàng ấm..."
          disabled={selectedIndex === null}
        />

        <div
          className={`prompt-length-status ${videoPromptTooLong ? 'over-limit' : videoPromptNearLimit ? 'near-limit' : 'within-limit'}`}
          role="status"
          aria-live="polite"
        >
          <div className="prompt-length-row">
            <strong>{videoPromptCharCount.toLocaleString('vi-VN')} / {MAX_VIDEO_PROMPT_CHARS.toLocaleString('vi-VN')} ký tự</strong>
            <span>
              {videoPromptCharCount > MAX_VIDEO_PROMPT_CHARS
                ? `Vượt ${Math.abs(videoPromptCharsRemaining).toLocaleString('vi-VN')} ký tự`
                : `Còn ${videoPromptCharsRemaining.toLocaleString('vi-VN')} ký tự`}
            </span>
          </div>
          <div className="prompt-length-secondary">
            <span>Mô tả bạn nhập</span>
            <strong>{userPromptCharCount.toLocaleString('vi-VN')} ký tự</strong>
            <small>Bộ đếm chính phía trên là prompt thực tế sau khi hệ thống bổ sung khóa nhận diện và yêu cầu đầu ra.</small>
          </div>
          <div className="prompt-length-secondary">
            <span>Dung lượng UTF-8</span>
            <strong>{videoPromptByteCount.toLocaleString('vi-VN')} / {MAX_VIDEO_PROMPT_CHARS.toLocaleString('vi-VN')} byte</strong>
            <small>{videoPromptByteCount > MAX_VIDEO_PROMPT_CHARS ? `Vượt ${Math.abs(videoPromptBytesRemaining).toLocaleString('vi-VN')} byte` : `Còn ${videoPromptBytesRemaining.toLocaleString('vi-VN')} byte`}</small>
          </div>
          <div className="prompt-length-track" aria-hidden="true">
            <span style={{ width: `${Math.min(100, (videoPromptLimitUsage / MAX_VIDEO_PROMPT_CHARS) * 100)}%` }} />
          </div>
          {videoPromptTooLong ? (
            <p>⚠️ Prompt đã vượt giới hạn an toàn 4.096 ở số ký tự hoặc dung lượng UTF-8. Hệ thống sẽ không cho xác nhận hoặc tạo video cho đến khi bạn rút gọn nội dung.</p>
          ) : videoPromptNearLimit ? (
            <p>⚠️ Prompt đang gần giới hạn. Nên rút gọn một số câu để có khoảng an toàn trước khi tạo video.</p>
          ) : (
            <p>✓ Prompt thực tế hợp lệ. Mô tả của bạn được giữ nguyên và hệ thống sẽ bổ sung khóa nhận diện/đầu ra kỹ thuật.</p>
          )}
        </div>

        <div className="confirmation-actions">
          <button className="secondary-button" type="button" onClick={() => setActiveTab('step-2')}>
            Quay lại chọn prompt
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={confirmPrompt}
            disabled={selectedIndex === null || !videoPrompt || videoPromptTooLong}
          >
            {promptConfirmed ? 'Đã xác nhận · Sang Bước 4' : 'Xác nhận mô tả · Sang Bước 4'}
          </button>
        </div>
      </section>
      ) : null}

      {activeTab === 'step-4' ? (
      <section className="step-card" id="step-4">
        <div className="step-head">
          <span className="step-number">4</span>
          <div>
            <h2>Tạo video bằng Grok Video 3 · 10s</h2>
            <p>Prompt đã được kiểm tra ở Bước 3. Bước 4 không dùng GPT-5.4; hệ thống gửi mô tả đã xác nhận + khóa giữ nguyên nhận diện + đúng metadata tỷ lệ/độ phân giải tới Grok Video 3.</p>
          </div>
        </div>

        {promptConfirmed ? (
          <div className="step4-confirmed-prompt">
            <span>Prompt đã xác nhận ở Bước 3 · {videoPromptCharCount.toLocaleString('vi-VN')} / {MAX_VIDEO_PROMPT_CHARS.toLocaleString('vi-VN')} ký tự</span>
            <p>{videoPrompt}</p>
          </div>
        ) : null}

        <div className="settings-grid">
          <label>
            <span>Thời lượng</span>
            <input type="number" value={10} disabled />
            <small className="muted">Cố định 10 giây; gửi bằng metadata.duration tới model {VIDEO_MODEL}</small>
          </label>
          <label>
            <span>Tỉ lệ</span>
            <select value={ratio} onChange={(e) => { setRatio(e.target.value); setVideoState(null); setVideoOutputMeta(null); }}>
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
              <option value="1:1">1:1</option>
              <option value="3:2">3:2</option>
              <option value="2:3">2:3</option>
            </select>
          </label>
          <label>
            <span>Độ phân giải</span>
            <select value={resolution} onChange={(e) => { setResolution(e.target.value as '720P' | '1080P'); setVideoState(null); setVideoOutputMeta(null); }}>
              <option value="1080P">1080P</option>
              <option value="720P">720P</option>
            </select>
          </label>
        </div>

        <div className="alert">
          <strong>Thiết lập sẽ gửi:</strong> {duration}s · {ratio} · {resolution}.
          {referenceImages.length ? <> Ảnh/frame đầu tiên được ưu tiên làm nguồn nhận diện chính; hệ thống tự thêm khóa chống đổi mặt/identity drift.</> : <> Chưa có ảnh tham chiếu nên không thể khóa nhận diện khuôn mặt.</>}
          <br />Thay đổi tỷ lệ hoặc độ phân giải yêu cầu tạo một video mới; kết quả cũ không được tái định dạng tự động.
        </div>

        <button
          className="primary-button full-button"
          onClick={generateVideo}
          disabled={videoLoading || !videoPrompt || videoPromptTooLong || !historyId || !promptConfirmed}
        >
          {videoLoading ? 'Đang gửi yêu cầu tạo video…' : 'Tạo video 10s'}
        </button>

        {videoState && videoState.status.toUpperCase() !== 'SUCCESS' && videoState.status.toUpperCase() !== 'FAILURE' ? (
          <div className="video-creating-notice" role="status" aria-live="polite">
            <span className="video-creating-spinner" aria-hidden="true" />
            <div>
              <strong>Đã ghi nhận yêu cầu tạo video</strong>
              <p>Video đang được tạo trên Mai Đức Minh&apos;web API. Sau khi thấy thông báo này, task đã được lưu vào lịch sử và bạn có thể đóng tab. Khi mở lại Lịch sử, hệ thống sẽ tự đồng bộ trạng thái và video hoàn tất.</p>
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
                  <span>Lịch sử chỉ hiển thị mô tả tiếng Việt bạn đã xác nhận để tạo video này.</span>
                </div>
                <video
                  controls
                  src={videoState.videoUrl}
                  preload="metadata"
                  onLoadedMetadata={(event) => {
                    const element = event.currentTarget;
                    setVideoOutputMeta({
                      width: element.videoWidth,
                      height: element.videoHeight,
                      duration: element.duration,
                    });
                  }}
                />
                {videoOutputMeta ? (
                  <div className="alert">
                    <strong>Thông số file video API trả về:</strong> {videoOutputMeta.width} × {videoOutputMeta.height}px · {Number.isFinite(videoOutputMeta.duration) ? `${videoOutputMeta.duration.toFixed(1)}s` : 'không đọc được thời lượng'}
                    <br />Yêu cầu đã gửi: {ratio} · {resolution} · {duration}s. Kích thước hiển thị trên web luôn co giãn theo khung trang, vì vậy hãy dùng số pixel này để kiểm tra độ phân giải thực tế.
                  </div>
                ) : null}
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
