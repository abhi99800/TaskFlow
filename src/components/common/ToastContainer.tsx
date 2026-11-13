import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
} from 'lucide-react';
import { ToastItem, ToastType } from '../../types';

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const toastTypeStyles: Record<
  ToastType,
  {
    borderLeft: string;
    icon: React.FC<{ className?: string }>;
    iconColor: string;
    iconBg: string;
    progressBarColor: string;
    defaultTitle: string;
  }
> = {
  success: {
    borderLeft: 'border-l-emerald-600',
    icon: CheckCircle2,
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-50 border-emerald-200',
    progressBarColor: 'bg-emerald-600',
    defaultTitle: 'Success',
  },
  warning: {
    borderLeft: 'border-l-amber-500',
    icon: AlertTriangle,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-50 border-amber-200',
    progressBarColor: 'bg-amber-500',
    defaultTitle: 'Attention Required',
  },
  error: {
    borderLeft: 'border-l-red-600',
    icon: AlertCircle,
    iconColor: 'text-red-600',
    iconBg: 'bg-red-50 border-red-200',
    progressBarColor: 'bg-red-600',
    defaultTitle: 'Error',
  },
  info: {
    borderLeft: 'border-l-[#71347b]',
    icon: Info,
    iconColor: 'text-[#71347b]',
    iconBg: 'bg-[#f5eff7] border-[#dfcadf]',
    progressBarColor: 'bg-[#71347b]',
    defaultTitle: 'Information',
  },
};

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-16 right-4 sm:top-[60px] sm:right-6 z-[80] flex flex-col gap-2.5 max-w-sm sm:max-w-md w-[calc(100%-2rem)] sm:w-auto pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => {
        const config = toastTypeStyles[toast.type] || toastTypeStyles.info;
        const IconComponent = config.icon;
        const duration = toast.duration || 5000;

        return (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto w-full bg-white border border-neutral-200 border-l-4 ${config.borderLeft} rounded-lg shadow-xl overflow-hidden flex flex-col toast-slide-in`}
          >
            <div className="p-3.5 sm:p-4 flex items-start gap-3">
              {/* Type Indicator Icon */}
              <div
                className={`w-7 h-7 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${config.iconBg}`}
              >
                <IconComponent className={`w-4 h-4 ${config.iconColor}`} />
              </div>

              {/* Toast Message & Title */}
              <div className="flex-1 min-w-0 pr-1">
                {toast.title && (
                  <h4 className="text-xs font-semibold text-neutral-900 leading-tight mb-0.5">
                    {toast.title}
                  </h4>
                )}
                <p className="text-xs sm:text-[13px] font-medium text-neutral-800 leading-snug break-words">
                  {toast.message}
                </p>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className="p-1 -mr-1 -mt-1 text-neutral-400 hover:text-neutral-700 rounded hover:bg-neutral-100 transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-[#71347b]"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Subtle Progress Bar */}
            {duration > 0 && (
              <div className="w-full h-1 bg-neutral-100 overflow-hidden">
                <div
                  className={`h-full ${config.progressBarColor} toast-progress-bar`}
                  style={{
                    animationDuration: `${duration}ms`,
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
