'use client';

import { useEffect, useRef } from 'react';

interface ConfirmTradeModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmTradeModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmTradeModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onCancel]);

  if (!open) return null;

  const confirmClass =
    variant === 'danger'
      ? 'btn btn-danger'
      : variant === 'warning'
      ? 'btn bg-yellow-600 hover:bg-yellow-500 text-white'
      : 'btn btn-primary';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 safe-area-top safe-area-bottom"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-trade-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close dialog"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-md bg-[#141c2b] border border-[#1e2738] rounded-2xl p-6 shadow-2xl animate-fade-in">
        <h2 id="confirm-trade-title" className="text-lg font-bold text-white mb-2">
          {title}
        </h2>
        <p className="text-secondary text-sm whitespace-pre-line mb-6">{message}</p>
        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button type="button" onClick={onCancel} className="btn btn-secondary min-h-[44px]">
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`${confirmClass} min-h-[44px]`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
