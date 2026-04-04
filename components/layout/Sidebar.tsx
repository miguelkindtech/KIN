"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/layout/ThemeToggle";
import type { Profile } from "@/lib/types";

const NAV_SECTIONS = [
  {
    label: "Workspace",
    items: [
      { href: "/overview", label: "Overview" },
      { href: "/calendar", label: "Calendar" },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/notes", label: "Notes" },
      { href: "/verticals", label: "Verticals" },
      { href: "/b2a", label: "Applied" },
    ],
  },
  {
    label: "Company",
    items: [
      { href: "/team", label: "Team" },
      { href: "/costs", label: "Costs" },
    ],
  },
];

interface SidebarProps {
  profile: Profile;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  mobileOpen?: boolean;
  onNavigate?: () => void;
}

export default function Sidebar({
  profile,
  theme,
  onToggleTheme,
  mobileOpen = false,
  onNavigate,
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
    <aside className={`sidebar${mobileOpen ? " mobile-open" : ""}`}>
      <div className="brand">
        <Link href="/overview" className="brand-link" onClick={onNavigate}>
          <Image
            src="/kind-logo.png"
            alt="kind."
            width={180}
            height={63}
            priority
            className={`brand-logo brand-logo-${theme}`}
          />
          <div className="brand-tagline">where the company thinks.</div>
        </Link>
      </div>

      <nav className="nav">
        {NAV_SECTIONS.map((section) => (
          <div className="nav-section" key={section.label}>
            <div className="nav-section-label">{section.label}</div>
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item${
                  pathname === item.href ? " active" : ""
                }`}
                onClick={onNavigate}
              >
                <span className="nav-icon" />
                {item.label}
              </Link>
            ))}
          </div>
        ))}
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
          <Image
            src="/footer-powered.png"
            alt="Powered by Kind Tech"
            width={150}
            height={15}
            className={`powered-watermark powered-watermark-${theme}`}
          />
        </div>
      </div>
    </aside>
  );
}
