import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export const SideDrawer: React.FC<SideDrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'max-w-[666px]',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-neutral-950/45 backdrop-blur-xs drawer-fade-in transition-opacity cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10 pointer-events-none">
        <div
          style={{ width: '666px', maxWidth: '100%' }}
          className={`w-[666px] sm:w-[666px] ${maxWidth} max-w-full bg-white shadow-2xl flex flex-col border-l border-neutral-200 drawer-slide-in relative h-full pointer-events-auto`}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/70 shrink-0">
            <div>
              <h2
                id="drawer-title"
                className="text-base font-semibold text-neutral-900 leading-tight"
              >
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs text-neutral-500 mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-md hover:bg-neutral-200/60 transition-colors focus-visible:outline-2 focus-visible:outline-[#71347b] cursor-pointer"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Independently Scrollable Form Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {children}
          </div>

          {/* Fixed Bottom Footer */}
          {footer && (
            <div className="px-6 py-3.5 border-t border-neutral-200 bg-white flex items-center justify-end gap-3 shrink-0 shadow-xs">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
