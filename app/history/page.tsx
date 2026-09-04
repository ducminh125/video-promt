import HistoryClient from '@/components/HistoryClient';

export const dynamic = 'force-dynamic';

export default function HistoryPage() {
  return (
    <main className="shell page-space">
      <section className="hero-panel history-hero">
        <div>
          <span className="eyebrow">LIBRARY</span>
          <h1>Lịch sử ảnh & video</h1>
          <p>Video đã gửi và hình ảnh tạo thành công được lưu riêng theo từng tab để bạn dễ xem lại prompt, tham chiếu và kết quả.</p>
        </div>
      </section>
      <HistoryClient />
    </main>
  );
}
