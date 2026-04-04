"use client";

interface HeaderProps {
  title: string;
  subtitle?: string;
  inboxCount: number;
  onOpenCapture: () => void;
}

export default function Header({
  title,
  subtitle,
  inboxCount,
  onOpenCapture,
}: HeaderProps) {
  return (
    <header className="app-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>

      <div className="header-actions">
        <button className="ghost-btn" onClick={onOpenCapture} type="button">
          Cmd+K Capture
        </button>
        <div className="inbox-badge">Inbox {inboxCount}</div>
      </div>
    </header>
  );
}
