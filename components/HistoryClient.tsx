'use client';

import { useEffect, useState } from 'react';
import type { HistoryItem, ImageHistoryItem } from '@/types';

type HistoryTab = 'video' | 'image';

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function HistoryClient() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [imageItems, setImageItems] = useState<ImageHistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<HistoryTab>('video');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadHistory(refreshPending = true) {
    setError('');
    try {
      const response = await fetch('/api/history', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không tải được lịch sử');
      const rows = (data.items || []) as HistoryItem[];
      const images = (data.imageItems || []) as ImageHistoryItem[];
      setItems(rows);
      setImageItems(images);

      if (refreshPending) {
        const pending = rows.filter((row) => row.task_id && !['SUCCESS', 'FAILURE'].includes(row.status));
        if (pending.length) {
          await Promise.allSettled(
            pending.slice(0, 10).map((row) =>
              fetch(`/api/video/status/${encodeURIComponent(row.task_id!)}`, { cache: 'no-store' }),
            ),
          );
          await loadHistory(false);
        }
      }
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : 'Không tải được lịch sử');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHistory(true);
  }, []);

  useEffect(() => {
    const hasPending = items.some((row) => row.task_id && !['SUCCESS', 'FAILURE'].includes(row.status));
    if (!hasPending) return;
    const timer = window.setInterval(() => void loadHistory(true), 10000);
    return () => window.clearInterval(timer);
  }, [items.map((row) => `${row.task_id || ''}:${row.status}`).join('|')]);

  async function deleteItem(id: string, kind: HistoryTab) {
    if (!window.confirm(kind === 'image' ? 'Xóa ảnh này khỏi lịch sử?' : 'Xóa bản ghi video này khỏi lịch sử?')) return;
    const response = await fetch('/api/history', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, kind }),
    });
    if (response.ok) {
      if (kind === 'image') setImageItems((current) => current.filter((row) => row.id !== id));
      else setItems((current) => current.filter((row) => row.id !== id));
    }
  }

  async function copyPrompt(prompt: string) {
    await navigator.clipboard.writeText(prompt);
  }

  if (loading) {
    return <div className="empty-state">Đang tải lịch sử…</div>;
  }

  return (
    <div>
      {error ? <div className="alert error-alert">{error}</div> : null}

      <div className="history-type-tabs" aria-label="Loại lịch sử">
        <button type="button" className={activeTab === 'video' ? 'active' : ''} onClick={() => setActiveTab('video')}>
          🎬 Video <span>{items.length}</span>
        </button>
        <button type="button" className={activeTab === 'image' ? 'active' : ''} onClick={() => setActiveTab('image')}>
          🖼️ Hình ảnh <span>{imageItems.length}</span>
        </button>
      </div>

      <div className="history-toolbar">
        <span>{activeTab === 'video' ? `${items.length} video gần nhất` : `${imageItems.length} ảnh gần nhất`}</span>
        <button className="secondary-button" type="button" onClick={() => loadHistory(true)}>
          Làm mới lịch sử
        </button>
      </div>

      {activeTab === 'video' ? (
        !items.length ? (
          <div className="empty-state">Chưa có video nào được tạo. Video sẽ xuất hiện ở đây sau khi bạn gửi tác vụ tạo video.</div>
        ) : (
          <div className="history-list">
            {items.map((item) => (
              <article className="history-card" key={item.id}>
                <div className="history-card-head">
                  <div>
                    <span className={`status-pill status-${item.status.toLowerCase()}`}>{item.status}</span>
                    <small>{formatDate(item.created_at)}</small>
                    <small>{item.model_video}</small>
                  </div>
                  <button className="text-button danger" type="button" onClick={() => deleteItem(item.id, 'video')}>Xóa</button>
                </div>

                <h2>{item.description}</h2>

                {item.settings?.duration ? (
                  <div className="history-request-settings">
                    <span>Thiết lập đã gửi:</span>
                    <strong>{item.settings.duration} giây</strong>
                    {item.settings.ratio ? <span>· {item.settings.ratio}</span> : null}
                    {item.settings.resolution ? <span>· {item.settings.resolution}</span> : null}
                  </div>
                ) : null}

                {item.selected_prompt ? (
                  <div className="selected-prompt-box">
                    <span>Mô tả tiếng Việt bạn đã xác nhận để tạo video</span>
                    <p>{item.selected_prompt}</p>
                    <button className="text-button" type="button" onClick={() => copyPrompt(item.selected_prompt!)}>Sao chép mô tả</button>
                  </div>
                ) : null}

                {Array.isArray(item.reference_images) && item.reference_images.length ? (
                  <div className="history-reference-strip">
                    {item.reference_images.slice(0, 8).map((url, index) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={`Reference ${index + 1}`} key={`${item.id}-ref-${index}`} />
                    ))}
                  </div>
                ) : null}

                {item.video_url ? (
                  <div className="video-result history-video">
                    <video controls src={item.video_url} preload="metadata" />
                    <a className="secondary-button link-button" href={item.video_url} target="_blank" rel="noreferrer">Mở video gốc</a>
                    <a className="primary-button link-button" href={`/api/video/download?id=${encodeURIComponent(item.id)}`}>Tải video về máy</a>
                  </div>
                ) : item.task_id ? (
                  <div className="task-line">
                    <span>Task: <code>{item.task_id}</code></span>
                    <span>{item.progress || 'Đang chờ'}</span>
                    {item.fail_reason ? <strong>{item.fail_reason}</strong> : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )
      ) : !imageItems.length ? (
        <div className="empty-state">Chưa có hình ảnh nào được tạo. Ảnh tạo thành công bằng gpt-image-2-all sẽ tự động lưu tại đây.</div>
      ) : (
        <div className="history-image-grid">
          {imageItems.map((item) => (
            <article className="history-card history-image-card" key={item.id}>
              <div className="history-card-head">
                <div>
                  <span className="status-pill status-success">SUCCESS</span>
                  <small>{formatDate(item.created_at)}</small>
                </div>
                <button className="text-button danger" type="button" onClick={() => deleteItem(item.id, 'image')}>Xóa</button>
              </div>

              <div className="history-image-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image_url} alt="Ảnh AI đã tạo" />
              </div>

              <div className="history-request-settings">
                <span>{item.model_image}</span>
                <strong>{item.ratio}</strong>
              </div>

              <div className="selected-prompt-box">
                <span>Mô tả đã xác nhận</span>
                <p>{item.description}</p>
                <button className="text-button" type="button" onClick={() => copyPrompt(item.description)}>Sao chép mô tả</button>
              </div>

              {item.production_prompt ? (
                <details className="history-image-details">
                  <summary>Xem prompt kỹ thuật</summary>
                  <p>{item.production_prompt}</p>
                </details>
              ) : null}

              {Array.isArray(item.reference_images) && item.reference_images.length ? (
                <div className="history-reference-strip">
                  {item.reference_images.slice(0, 4).map((url, index) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={`Ảnh tham chiếu ${index + 1}`} key={`${item.id}-image-ref-${index}`} />
                  ))}
                </div>
              ) : null}

              <a className="secondary-button link-button" href={item.image_url} target="_blank" rel="noreferrer">Mở ảnh gốc</a>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
