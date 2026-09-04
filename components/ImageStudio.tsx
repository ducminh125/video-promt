'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { compressImage, uploadReferenceImage } from '@/lib/media-client';
import type { PromptSuggestion, SourceMedia } from '@/types';

type ImageWorkflowTab = 'step-1' | 'step-2' | 'step-3' | 'step-4';

type ImageStudioProps = {
  onUseForVideo: (url: string) => void;
};

const MAX_IMAGE_REFERENCES = 4;

const IMAGE_RATIO_OPTIONS = [
  { value: '16:9', label: '16:9 · ngang' },
  { value: '9:16', label: '9:16 · dọc' },
  { value: '1:1', label: '1:1 · vuông' },
  { value: '4:3', label: '4:3 · ngang' },
  { value: '3:4', label: '3:4 · dọc' },
  { value: '3:2', label: '3:2 · ngang' },
  { value: '2:3', label: '2:3 · dọc' },
];

export default function ImageStudio({ onUseForVideo }: ImageStudioProps) {
  const [description, setDescription] = useState('');
  const [media, setMedia] = useState<SourceMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [suggestions, setSuggestions] = useState<PromptSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [editedDescriptionVi, setEditedDescriptionVi] = useState('');
  const [promptConfirmed, setPromptConfirmed] = useState(false);
  const [activeTab, setActiveTab] = useState<ImageWorkflowTab>('step-1');
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptWaitSeconds, setPromptWaitSeconds] = useState(0);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageWaitSeconds, setImageWaitSeconds] = useState(0);
  const [imageUrl, setImageUrl] = useState('');
  const [historyNotice, setHistoryNotice] = useState('');
  const [ratio, setRatio] = useState('16:9');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const referenceImages = useMemo(
    () => media.flatMap((item) => item.referenceUrls).slice(0, MAX_IMAGE_REFERENCES),
    [media],
  );

  const imageEnhancements: Array<{ id: string; label: string; options: Array<[string, string, string]> }> = [
    {
      id: 'character',
      label: '👤 Nhân vật',
      options: [
        ['preserve', 'Giữ đúng nhân vật tham chiếu', 'Nhân vật: nếu có ảnh tham chiếu, phải giữ đúng khuôn mặt, nhận diện, tóc, tuổi, vóc dáng, trang phục và các đặc điểm nhận biết của người trong ảnh.'],
        ['natural', 'Tự nhiên, chân thực', 'Nhân vật: khuôn mặt và cơ thể chân thực, biểu cảm tự nhiên, tỷ lệ giải phẫu hợp lý, da và tóc có texture thật.'],
        ['cinematic', 'Điện ảnh', 'Nhân vật: phong cách cinematic realism, biểu cảm tinh tế, tạo dáng có chủ đích nhưng vẫn tự nhiên.'],
        ['commercial', 'Quảng cáo cao cấp', 'Nhân vật: chỉn chu như ảnh quảng cáo cao cấp, biểu cảm tự tin, sạch và chuyên nghiệp.'],
      ],
    },
    {
      id: 'composition',
      label: '🖼️ Bố cục',
      options: [
        ['centered', 'Chủ thể trung tâm', 'Bố cục: chủ thể chính ở trung tâm, phân cấp thị giác rõ, khoảng trống cân đối và dễ nhìn.'],
        ['thirds', 'Quy tắc 1/3', 'Bố cục: áp dụng rule of thirds, điểm nhìn tự nhiên, có tiền cảnh - trung cảnh - hậu cảnh rõ ràng.'],
        ['closeup', 'Cận cảnh', 'Bố cục: close-up hoặc medium close-up, tập trung mạnh vào khuôn mặt/chủ thể và chi tiết quan trọng.'],
        ['wide', 'Toàn cảnh có chiều sâu', 'Bố cục: góc rộng, thể hiện đầy đủ bối cảnh, chiều sâu không gian và mối quan hệ giữa chủ thể với môi trường.'],
      ],
    },
    {
      id: 'lighting',
      label: '💡 Ánh sáng & màu',
      options: [
        ['soft-studio', 'Studio mềm', 'Ánh sáng và màu sắc: soft studio lighting, bóng đổ mềm, màu da/vật liệu trung thực, tương phản vừa phải.'],
        ['daylight', 'Ánh sáng tự nhiên', 'Ánh sáng và màu sắc: natural daylight, màu trung thực, highlight tự nhiên, không ám màu quá mức.'],
        ['cinematic', 'Cinematic tương phản', 'Ánh sáng và màu sắc: cinematic lighting, tương phản có kiểm soát, chiều sâu rõ và bảng màu hài hòa.'],
        ['warm', 'Ấm áp', 'Ánh sáng và màu sắc: tông ấm, ánh vàng nhẹ, mood dễ chịu, highlight mềm và giàu cảm xúc.'],
      ],
    },
    {
      id: 'detail',
      label: '🔎 Chất liệu & chi tiết',
      options: [
        ['real-texture', 'Texture chân thực', 'Chất liệu và chi tiết: texture chân thực, vật liệu đúng thực tế, bề mặt và chi tiết nhỏ sắc nét.'],
        ['clean', 'Sạch, tối giản', 'Chất liệu và chi tiết: hình ảnh sạch, loại bỏ chi tiết gây nhiễu, không tự ý thêm chữ/logo/vật thể ngoài yêu cầu.'],
        ['product', 'Chi tiết sản phẩm cao', 'Chất liệu và chi tiết: ưu tiên độ chính xác hình khối, màu sắc, vật liệu, logo/chữ có sẵn và các đặc điểm nhận diện sản phẩm.'],
      ],
    },
    {
      id: 'style',
      label: '🎨 Phong cách ảnh',
      options: [
        ['photorealistic', 'Photorealistic', 'Phong cách ảnh: photorealistic, high detail, natural depth, realistic optics and materials.'],
        ['cinematic', 'Cinematic', 'Phong cách ảnh: cinematic still photography, realistic, giàu chiều sâu, bố cục và ánh sáng như khung hình phim.'],
        ['editorial', 'Editorial', 'Phong cách ảnh: editorial photography hiện đại, tinh tế, có cá tính nhưng vẫn tự nhiên và chân thực.'],
        ['premium', 'Premium commercial', 'Phong cách ảnh: premium commercial photography, sạch, sang trọng, chi tiết sản phẩm/chủ thể rõ và có tính quảng cáo cao.'],
      ],
    },
  ];

  const [enhancementSelections, setEnhancementSelections] = useState<Record<string, string>>({});

  const selectedImageDetails = imageEnhancements.flatMap((group) => {
    const selectedValue = enhancementSelections[group.id];
    const option = group.options.find(([value]) => value === selectedValue);
    return option ? [option[2]] : [];
  });
  const combinedDescription = [description.trim(), ...selectedImageDetails].filter(Boolean).join('\n');

  function invalidateDownstream() {
    setSuggestions([]);
    setSelectedIndex(null);
    setEditedPrompt('');
    setEditedDescriptionVi('');
    setPromptConfirmed(false);
    setImageUrl('');
    setHistoryNotice('');
  }

  function setEnhancement(groupId: string, value: string) {
    invalidateDownstream();
    setEnhancementSelections((current) => ({ ...current, [groupId]: value }));
  }

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
    if (!imageLoading) {
      setImageWaitSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setImageWaitSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [imageLoading]);

  async function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setError('');
    invalidateDownstream();
    const incoming = Array.from(fileList).slice(0, Math.max(0, MAX_IMAGE_REFERENCES - media.length));
    if (!incoming.length) {
      setError(`Tối đa ${MAX_IMAGE_REFERENCES} ảnh tham chiếu.`);
      return;
    }

    setUploading(true);
    try {
      const added: SourceMedia[] = [];
      for (const file of incoming) {
        if (!file.type.startsWith('image/')) {
          throw new Error(`Thẻ tạo ảnh chỉ nhận file ảnh. Không hỗ trợ ${file.type || file.name}.`);
        }
        setUploadMessage(`Đang tối ưu ảnh: ${file.name}`);
        const compressed = await compressImage(file, 1500);
        const url = await uploadReferenceImage(compressed);
        added.push({
          id: crypto.randomUUID(),
          name: file.name,
          kind: 'image',
          previewUrl: URL.createObjectURL(file),
          referenceUrls: [url],
        });
      }
      setMedia((current) => [...current, ...added]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Không xử lý được ảnh tham chiếu');
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
    invalidateDownstream();
    try {
      const response = await fetch('/api/image/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: combinedDescription, referenceImages }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không tạo được prompt ảnh');
      setSuggestions(data.suggestions || []);
      setActiveTab('step-2');
    } catch (promptError) {
      setError(promptError instanceof Error ? promptError.message : 'Không tạo được prompt ảnh');
    } finally {
      setPromptLoading(false);
    }
  }

  function choosePrompt(index: number) {
    setSelectedIndex(index);
    setEditedPrompt(suggestions[index].prompt);
    setEditedDescriptionVi(suggestions[index].descriptionVi || suggestions[index].why || '');
    setPromptConfirmed(false);
    setImageUrl('');
    setError('');
    setActiveTab('step-3');
  }

  function confirmPrompt() {
    if (selectedIndex === null || !editedDescriptionVi.trim()) {
      setError('Hãy chọn và điều chỉnh mô tả tiếng Việt trước khi xác nhận.');
      return;
    }
    setError('');
    setPromptConfirmed(true);
    setImageUrl('');
    setActiveTab('step-4');
  }

  async function generateImage() {
    if (!promptConfirmed || !editedDescriptionVi.trim()) {
      setError('Hãy xác nhận mô tả tiếng Việt ở Bước 3 trước khi tạo ảnh.');
      return;
    }
    setError('');
    setImageLoading(true);
    setImageUrl('');
    setHistoryNotice('');
    try {
      const response = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: editedPrompt,
          descriptionVi: editedDescriptionVi,
          referenceImages,
          ratio,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không tạo được ảnh');
      setImageUrl(String(data.imageUrl || ''));
      if (!data.imageUrl) throw new Error('API không trả về URL ảnh hợp lệ.');
      setHistoryNotice(data.historySaved ? 'Ảnh đã được lưu vào Lịch sử.' : (data.historyWarning ? `Ảnh đã tạo thành công nhưng chưa lưu được lịch sử: ${data.historyWarning}` : '')); 
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : 'Không tạo được ảnh');
    } finally {
      setImageLoading(false);
    }
  }

  return (
    <main className="shell page-space">
      <section className="hero-panel">
        <div>
          <span className="eyebrow">AI IMAGE WORKFLOW</span>
          <h1>Từ ý tưởng đến ảnh trong 4 bước</h1>
          <p>
            Miêu tả nội dung, thêm ảnh tham chiếu, nhận 3 phương án từ GPT-5.4 rồi tạo ảnh bằng gpt-image-2-all.
          </p>
        </div>
        <div className="hero-badge">
          <strong>Mai Đức Minh&apos;web</strong>
          <span>AI API</span>
        </div>
      </section>

      {error ? <div className="alert error-alert">{error}</div> : null}

      <nav className="workflow-tabs" aria-label="Các bước tạo ảnh">
        <button type="button" className={`workflow-tab ${activeTab === 'step-1' ? 'active' : ''}`} onClick={() => setActiveTab('step-1')}>
          <span className="workflow-tab-number">1</span>
          <span className="workflow-tab-copy"><strong>Bước 1</strong><small>Ý tưởng & tham chiếu</small></span>
        </button>
        <button type="button" className={`workflow-tab ${activeTab === 'step-2' ? 'active' : ''}`} onClick={() => setActiveTab('step-2')} disabled={!suggestions.length}>
          <span className="workflow-tab-number">2</span>
          <span className="workflow-tab-copy"><strong>Bước 2</strong><small>{suggestions.length ? 'Chọn 1 trong 3 prompt' : 'Chờ prompt từ bước 1'}</small></span>
        </button>
        <button type="button" className={`workflow-tab ${activeTab === 'step-3' ? 'active' : ''}`} onClick={() => setActiveTab('step-3')} disabled={selectedIndex === null}>
          <span className="workflow-tab-number">3</span>
          <span className="workflow-tab-copy"><strong>Bước 3</strong><small>{selectedIndex !== null ? (promptConfirmed ? 'Mô tả đã xác nhận' : 'Điều chỉnh mô tả tiếng Việt') : 'Chưa chọn phương án'}</small></span>
        </button>
        <button type="button" className={`workflow-tab ${activeTab === 'step-4' ? 'active' : ''}`} onClick={() => setActiveTab('step-4')} disabled={!promptConfirmed && !imageUrl}>
          <span className="workflow-tab-number">4</span>
          <span className="workflow-tab-copy"><strong>Bước 4</strong><small>{imageLoading ? 'Ảnh đang được tạo' : imageUrl ? 'Ảnh đã hoàn thành' : promptConfirmed ? 'Sẵn sàng tạo ảnh' : 'Chờ xác nhận ở bước 3'}</small></span>
          {imageLoading ? <span className="tab-live-dot" aria-label="Ảnh đang được tạo" /> : null}
        </button>
      </nav>

      {activeTab === 'step-1' ? (
        <section className="step-card" id="image-step-1">
          <div className="step-head">
            <span className="step-number">1</span>
            <div>
              <h2>Miêu tả hình ảnh</h2>
              <p>Nêu rõ chủ thể, bối cảnh, bố cục, ánh sáng, phong cách và chi tiết phải giữ nguyên.</p>
            </div>
          </div>

          <div className="enhancement-panel">
            <div className="enhancement-panel-head">
              <strong>Tùy chọn gợi ý</strong>
              <span>Chọn trực tiếp cho từng nhóm. Các lựa chọn sẽ được ghép cùng mô tả khi tạo 3 prompt ảnh, không chèn chữ vào ô mô tả.</span>
            </div>
            <div className="enhancement-grid">
              {imageEnhancements.map((group) => (
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
            placeholder="Ví dụ: Tạo ảnh quảng cáo photorealistic, nhân vật giữ đúng khuôn mặt theo ảnh tham chiếu, ánh sáng studio mềm, bố cục premium, không thêm chữ ngoài yêu cầu..."
            rows={7}
          />

          {Object.values(enhancementSelections).some(Boolean) ? (
            <details className="combined-description-preview">
              <summary>Xem nội dung đầy đủ sẽ gửi cho AI</summary>
              <p>{combinedDescription}</p>
            </details>
          ) : null}

          <div className="upload-zone" onClick={() => inputRef.current?.click()}>
            <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(event) => addFiles(event.target.files)} />
            <strong>{uploading ? 'Đang xử lý ảnh…' : 'Thêm ảnh tham chiếu (tùy chọn)'}</strong>
            <span>Tối đa {MAX_IMAGE_REFERENCES} ảnh. Ảnh được nén trước khi upload để tăng độ ổn định khi tạo ảnh.</span>
            {uploadMessage ? <em>{uploadMessage}</em> : null}
          </div>

          {media.length ? (
            <div className="media-grid">
              {media.map((item) => (
                <article className="media-card" key={item.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.previewUrl} alt={item.name} />
                  <div><strong>{item.name}</strong><span>Ảnh tham chiếu</span></div>
                  <button type="button" className="text-button danger" onClick={() => removeMedia(item.id)}>Xóa</button>
                </article>
              ))}
            </div>
          ) : null}

          <div className="actions-row">
            <span className="muted">{referenceImages.length} ảnh sẽ được dùng để GPT-5.4 phân tích và gpt-image-2-all tham chiếu.</span>
            <button className="primary-button" onClick={generatePrompts} disabled={promptLoading || uploading || combinedDescription.trim().length < 10}>
              {promptLoading ? 'GPT-5.4 đang tạo 3 prompt…' : 'Tạo 3 gợi ý prompt ảnh'}
            </button>
          </div>

          {promptLoading ? (
            <div className="prompt-waiting-panel" role="status" aria-live="polite">
              <span className="prompt-waiting-spinner" aria-hidden="true" />
              <div className="prompt-waiting-content">
                <div className="prompt-waiting-title"><strong>Đang xây dựng 3 phương án ảnh</strong><span>{promptWaitSeconds}s</span></div>
                <p>GPT-5.4 đang đọc mô tả và ảnh tham chiếu để tạo các phương án có bố cục, ánh sáng và phong cách khác nhau.</p>
                <div className="prompt-waiting-progress" aria-hidden="true"><span /></div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'step-2' ? (
        <section className="step-card" id="image-step-2">
          <div className="step-head">
            <span className="step-number">2</span>
            <div><h2>Chọn một prompt ảnh</h2><p>Chọn phương án gần nhất với hình ảnh bạn muốn tạo.</p></div>
          </div>

          {!suggestions.length ? <div className="empty-state">Prompt ảnh sẽ xuất hiện sau khi hoàn thành Bước 1.</div> : (
            <div className="prompt-grid">
              {suggestions.map((item, index) => (
                <article className={`prompt-card ${selectedIndex === index ? 'selected' : ''}`} key={`${item.title}-${index}`}>
                  <div className="prompt-topline"><span>Phương án {index + 1}</span><strong>{item.title}</strong></div>
                  <div className="prompt-description-vi"><span>Mô tả tiếng Việt</span><p>{item.descriptionVi || item.why}</p></div>
                  <details className="prompt-english-details"><summary>Xem prompt tiếng Anh gửi cho AI</summary><p className="prompt-body">{item.prompt}</p></details>
                  {item.why ? <p className="prompt-why"><strong>Điểm nổi bật:</strong> {item.why}</p> : null}
                  <button className="secondary-button" type="button" onClick={() => choosePrompt(index)}>{selectedIndex === index ? 'Chọn lại / chỉnh sửa' : 'Chọn prompt này'}</button>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === 'step-3' ? (
        <section className="step-card" id="image-step-3">
          <div className="step-head">
            <span className="step-number">3</span>
            <div><h2>Điều chỉnh mô tả bằng tiếng Việt</h2><p>Mô tả đã xác nhận sẽ là chỉ dẫn ưu tiên khi gpt-image-2-all tạo ảnh.</p></div>
          </div>

          {selectedIndex !== null ? (
            <div className="confirmed-choice-summary"><span>Phương án đang chọn</span><strong>Phương án {selectedIndex + 1}: {suggestions[selectedIndex]?.title}</strong><p>{suggestions[selectedIndex]?.descriptionVi || suggestions[selectedIndex]?.why}</p></div>
          ) : null}

          <textarea className="large-textarea prompt-editor" value={editedDescriptionVi} onChange={(event) => { setEditedDescriptionVi(event.target.value); setPromptConfirmed(false); setImageUrl(''); }} rows={11} placeholder="Ví dụ: Giữ nguyên khuôn mặt theo ảnh tham chiếu, nền studio tối giản, ánh sáng mềm, sản phẩm ở trung tâm..." disabled={selectedIndex === null} />

          <div className="confirmation-actions">
            <button className="secondary-button" type="button" onClick={() => setActiveTab('step-2')}>Quay lại chọn prompt</button>
            <button className="primary-button" type="button" onClick={confirmPrompt} disabled={selectedIndex === null || !editedDescriptionVi.trim()}>{promptConfirmed ? 'Đã xác nhận · Sang Bước 4' : 'Xác nhận mô tả · Sang Bước 4'}</button>
          </div>
        </section>
      ) : null}

      {activeTab === 'step-4' ? (
        <section className="step-card" id="image-step-4">
          <div className="step-head">
            <span className="step-number">4</span>
            <div><h2>Tạo ảnh bằng gpt-image-2-all</h2><p>Tỉ lệ được đưa vào đầu prompt vì model này dùng mô tả prompt để định hướng khung hình.</p></div>
          </div>

          {promptConfirmed ? <div className="step4-confirmed-prompt"><span>Mô tả tiếng Việt đã xác nhận ở Bước 3</span><p>{editedDescriptionVi}</p></div> : null}

          <div className="settings-grid image-settings-grid">
            <label>
              <span>Tỉ lệ ảnh</span>
              <select value={ratio} onChange={(event) => { setRatio(event.target.value); setImageUrl(''); }}>
                {IMAGE_RATIO_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
              </select>
              <small className="muted">Tỉ lệ là định hướng, không cam kết pixel tuyệt đối.</small>
            </label>
            <label>
              <span>Model</span>
              <input type="text" value="gpt-image-2-all" disabled />
              <small className="muted">Một lần tạo trả về 1 ảnh.</small>
            </label>
          </div>

          <button className="primary-button full-button" type="button" onClick={generateImage} disabled={imageLoading || !promptConfirmed || !editedDescriptionVi.trim()}>
            {imageLoading ? `Đang tạo ảnh… ${imageWaitSeconds}s` : 'Tạo ảnh với gpt-image-2-all'}
          </button>

          {imageLoading ? (
            <div className="video-creating-notice" role="status" aria-live="polite">
              <span className="video-creating-spinner" aria-hidden="true" />
              <div><strong>Mai Đức Minh&apos;web API đang tạo ảnh</strong><p>Ảnh là tác vụ đồng bộ nên hãy giữ trang này mở cho đến khi kết quả xuất hiện. Hệ thống sẽ cố gắng lưu ảnh kết quả vào Blob để dùng tiếp làm ảnh tham chiếu cho video.</p></div>
            </div>
          ) : null}

          {imageUrl ? (
            <div className="result-panel image-result-panel">
              <div className="image-result-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Ảnh được tạo bởi gpt-image-2-all" />
              </div>
              <div className="image-result-actions">
                <a className="secondary-button link-button" href={imageUrl} target="_blank" rel="noreferrer">Mở ảnh gốc</a>
                <button className="primary-button" type="button" onClick={() => onUseForVideo(imageUrl)}>Dùng ảnh này làm ảnh minh họa tạo video</button>
              </div>
              {historyNotice ? <div className="history-saved-note"><strong>Lịch sử ảnh</strong><span>{historyNotice}</span></div> : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
