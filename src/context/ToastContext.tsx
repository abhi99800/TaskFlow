import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { ToastItem, ToastType } from '../types';
import { ToastContainer } from '../components/common/ToastContainer';

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (options: {
    type?: ToastType;
    message: string;
    title?: string;
    duration?: number;
  }) => string;
  showSuccess: (message: string, title?: string) => string;
  showWarning: (message: string, title?: string) => string;
  showError: (message: string, title?: string) => string;
  showInfo: (message: string, title?: string) => string;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const removeToast = useCallback((id: string) => {
    // Clear any active timeout
    const existingTimer = timersRef.current.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({
      type = 'info',
      message,
      title,
      duration = 5000,
    }: {
      type?: ToastType;
      message: string;
      title?: string;
      duration?: number;
    }) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newToast: ToastItem = {
        id,
        type,
        message,
        title,
        duration,
      };

      setToasts((prev) => [...prev, newToast]);

      // Automatically dismiss after exactly 5 seconds (or specified duration)
      if (duration > 0) {
        const timer = setTimeout(() => {
          removeToast(id);
        }, duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [removeToast]
  );

  const showSuccess = useCallback(
    (message: string, title?: string) => {
      return showToast({ type: 'success', message, title, duration: 5000 });
    },
    [showToast]
  );

  const showWarning = useCallback(
    (message: string, title?: string) => {
      return showToast({ type: 'warning', message, title, duration: 5000 });
    },
    [showToast]
  );

  const showError = useCallback(
    (message: string, title?: string) => {
      return showToast({ type: 'error', message, title, duration: 5000 });
    },
    [showToast]
  );

  const showInfo = useCallback(
    (message: string, title?: string) => {
      return showToast({ type: 'info', message, title, duration: 5000 });
    },
    [showToast]
  );

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        showSuccess,
        showWarning,
        showError,
        showInfo,
        removeToast,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
