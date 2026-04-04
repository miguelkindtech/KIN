"use client";

interface HeaderProps {
  title: string;
  subtitle?: string;
  inboxCount: number;
  onOpenCapture: () => void;
  onOpenNav: () => void;
}

export default function Header({
  title,
  subtitle,
  inboxCount,
  onOpenCapture,
  onOpenNav,
}: HeaderProps) {
  return (
    <header className="app-header">
      <div className="header-title-wrap">
        <button className="mobile-nav-btn" onClick={onOpenNav} type="button">
          Menu
        </button>
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>

      <div className="header-actions">
        <button className="ghost-btn" onClick={onOpenCapture} type="button">
          Capture
        </button>
        <div className="inbox-badge">Inbox {inboxCount}</div>
      </div>
    </header>
  );
}
