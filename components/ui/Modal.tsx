"use client";
import { useEffect, useRef } from "react";

interface ModalProps {
  show: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({ show, onClose, title, children }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show || !ref.current) return;
    const target = ref.current.querySelector("input, textarea, select") as HTMLElement | null;
    if (target) setTimeout(() => target.focus(), 40);
  }, [show]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (show) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [show, onClose]);

  if (!show) return null;
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" ref={ref}>
        <div className="modal-title">{title}</div>
        {children}
      </div>
    </div>
  );
}
