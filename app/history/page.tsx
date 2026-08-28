import HistoryClient from '@/components/HistoryClient';

export const dynamic = 'force-dynamic';

export default function HistoryPage() {
  return (
    <main className="shell page-space">
      <section className="hero-panel history-hero">
        <div>
          <span className="eyebrow">LIBRARY</span>
          <h1>Lịch sử video</h1>
          <p>Chỉ prompt bạn đã chọn để tạo video, trạng thái tác vụ và video hoàn thành được lưu và hiển thị tại đây.</p>
        </div>
      </section>
      <HistoryClient />
    </main>
  );
}
