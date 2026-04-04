"use client";

interface ThemeToggleProps {
  theme: "light" | "dark";
  onToggle: () => void;
}

export default function ThemeToggle({
  theme,
  onToggle,
}: ThemeToggleProps) {
  return (
    <button
      className="theme-toggle"
      onClick={onToggle}
      type="button"
      aria-label="Toggle theme"
    >
      <span className={`theme-dot${theme === "dark" ? " active" : ""}`} />
      <span className={`theme-dot${theme === "light" ? " active" : ""}`} />
    </button>
  );
}
