import React from 'react';
import { LogOut, X, AlertTriangle } from 'lucide-react';

interface SignOutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userEmail?: string;
  userRole?: string | null;
}

export const SignOutConfirmModal: React.FC<SignOutConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  userEmail,
  userRole,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signout-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-neutral-950/45 backdrop-blur-xs transition-opacity drawer-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-md border border-neutral-200">
          {/* Header */}
          <div className="px-5 pt-5 pb-4 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                <LogOut className="w-5 h-5 ml-0.5" />
              </div>
              <div>
                <h3 id="signout-dialog-title" className="text-base font-semibold text-neutral-900 leading-tight">
                  Sign Out Confirmation
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  End your current workspace session
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-700 p-1 rounded-md hover:bg-neutral-100 transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-5 pb-5">
            <div className="p-3.5 bg-neutral-50 rounded-lg border border-neutral-200/80 mb-4">
              <p className="text-sm font-medium text-neutral-800">
                Are you sure you want to sign out?
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                You will be redirected to the sign-in screen. Any unsaved form inputs will be discarded.
              </p>
              {userEmail && (
                <div className="mt-2.5 pt-2 border-t border-neutral-200/60 flex items-center justify-between text-xs">
                  <span className="text-neutral-500">Current Session:</span>
                  <span className="font-mono text-neutral-800 font-semibold">{userEmail}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="bg-neutral-50/80 px-5 py-3 border-t border-neutral-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 transition-colors focus-visible:outline-2 focus-visible:outline-[#71347b]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-white bg-[#71347b] hover:bg-[#5d2a65] active:bg-[#4b2152] rounded-md transition-colors shadow-xs focus-visible:outline-2 focus-visible:outline-[#71347b] flex items-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span>Confirm Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
