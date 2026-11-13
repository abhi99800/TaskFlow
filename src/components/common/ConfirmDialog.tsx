import React from 'react';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  taskTitle?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'emerald' | 'danger';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title = 'Confirm Action',
  message,
  taskTitle,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'emerald',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const confirmColors =
    confirmVariant === 'emerald'
      ? 'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500'
      : confirmVariant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500'
      : 'bg-[#71347b] hover:bg-[#5b2a64] text-white focus:ring-[#71347b]';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in-0 duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-neutral-200 animate-in zoom-in-95 duration-150">
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3
                id="confirm-dialog-title"
                className="text-base font-semibold text-neutral-900"
              >
                {title}
              </h3>
              <p
                id="confirm-dialog-message"
                className="text-sm text-neutral-600 mt-1"
              >
                {message}
              </p>
              {taskTitle && (
                <div className="mt-2 p-2.5 bg-neutral-50 rounded border border-neutral-200 text-xs font-medium text-neutral-800 break-words">
                  <span className="text-neutral-500 block text-[11px] uppercase tracking-wider font-semibold">
                    Task
                  </span>
                  {taskTitle}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-3.5 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 ${confirmColors}`}
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
