import HistoryClient from '@/components/HistoryClient';

export const dynamic = 'force-dynamic';

export default function HistoryPage() {
  return (
    <main className="shell page-space">
      <section className="hero-panel history-hero">
        <div>
          <span className="eyebrow">LIBRARY</span>
          <h1>Lịch sử prompt & video</h1>
          <p>Toàn bộ 3 prompt gợi ý, prompt đã chỉnh, task Grok Video 3 và video hoàn thành được lưu tại đây.</p>
        </div>
      </section>
      <HistoryClient />
    </main>
  );
}
