// src/components/ConfirmDialog.tsx
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, HelpCircle } from 'lucide-react';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  return createPortal(
    <div
      className="modal-overlay center"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      style={{ zIndex: 9999 }}
    >
      <div
        className="modal-content"
        style={{
          width: 400,
          textAlign: 'center',
          padding: '32px 28px',
          animation: 'fadeIn 0.15s ease-out',
        }}
      >
        {/* Icon */}
        <div style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: danger ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          {danger
            ? <Trash2 size={24} style={{ color: '#ef4444' }} />
            : <HelpCircle size={24} style={{ color: '#3b82f6' }} />}
        </div>

        {/* Title */}
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
          {title}
        </div>

        {/* Message */}
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
          {message}
        </div>

        {/* Warning strip for danger */}
        {danger && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 8,
            marginBottom: 20,
            textAlign: 'left',
          }}>
            <AlertTriangle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#fca5a5' }}>
              Tindakan ini tidak dapat dibatalkan.
            </span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            style={{ minWidth: 100 }}
          >
            {cancelLabel}
          </button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            style={{
              minWidth: 100,
              ...(danger ? { background: '#ef4444', borderColor: '#ef4444' } : {}),
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
