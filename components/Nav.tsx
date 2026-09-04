import Link from 'next/link';

export default function Nav() {
  return (
    <header className="topbar">
      <div className="shell nav-inner">
        <Link href="/" className="brand">
          <span className="brand-mark">V</span>
          <span>
            <strong>Mai Đức Minh&apos;web AI Studio</strong>
            <small>GPT-5.4 · Grok Video 3 10s · GPT-Image-2</small>
          </span>
        </Link>
        <nav className="nav-links" aria-label="Main navigation">
          <Link href="/">Studio AI</Link>
          <Link href="/history">Lịch sử</Link>
        </nav>
      </div>
    </header>
  );
}
