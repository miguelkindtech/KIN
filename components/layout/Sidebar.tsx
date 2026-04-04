"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/layout/ThemeToggle";
import type { Profile } from "@/lib/types";

const NAV = [
  { href: "/overview", label: "Overview" },
  { href: "/calendar", label: "Calendar" },
  { href: "/verticals", label: "Verticals" },
  { href: "/b2a", label: "B2A" },
  { href: "/notes", label: "Notes" },
  { href: "/team", label: "Team" },
  { href: "/costs", label: "Costs" },
];

interface SidebarProps {
  profile: Profile;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export default function Sidebar({
  profile,
  theme,
  onToggleTheme,
}: SidebarProps) {
  const pathname = usePathname();
  const initials =
    profile.avatarInitials ||
    profile.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-title">KIN</div>
        <div className="brand-subtitle">
          Executive operating system for Kind Tech.
        </div>
      </div>

      <nav className="nav">
        <div className="nav-section">
          <div className="nav-section-label">Workspace</div>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${
                pathname === item.href ? " active" : ""
              }`}
            >
              <span className="nav-icon" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div
            className="avatar"
            style={{ background: profile.color || "#7F6FD4" }}
          >
            {initials}
          </div>
          <div>
            <div className="sidebar-user-name">{profile.name}</div>
            <div className="sidebar-user-role">{profile.role}</div>
          </div>
        </div>

        <div className="sidebar-meta">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <div className="powered-by">Powered by Kind Tech</div>
        </div>
      </div>
    </aside>
  );
}
