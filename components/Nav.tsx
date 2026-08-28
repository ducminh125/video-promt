import Link from 'next/link';

export default function Nav() {
  return (
    <header className="topbar">
      <div className="shell nav-inner">
        <Link href="/" className="brand">
          <span className="brand-mark">V</span>
          <span>
            <strong>Video Prompt Studio</strong>
            <small>GPT-5.4 → Grok Video 3</small>
          </span>
        </Link>
        <nav className="nav-links" aria-label="Main navigation">
          <Link href="/">Tạo video</Link>
          <Link href="/history">Lịch sử</Link>
        </nav>
      </div>
    </header>
  );
}
