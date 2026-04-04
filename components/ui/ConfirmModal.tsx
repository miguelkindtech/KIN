"use client";

interface ConfirmModalProps {
  show: boolean;
  onClose: () => void;
  onConfirm: () => void;
  label: string;
}

export default function ConfirmModal({ show, onClose, onConfirm, label }: ConfirmModalProps) {
  if (!show) return null;
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <div className="modal-title">delete {label}?</div>
        <div className="page-subtitle">this action cannot be undone.</div>
        <div className="modal-actions">
          <button className="ghost-btn" onClick={onClose}>cancel</button>
          <button className="danger-btn" onClick={onConfirm}>delete</button>
        </div>
      </div>
    </div>
  );
}
