'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import styles from './Toast.module.css';

export type ToastTone = 'success' | 'info' | 'warning' | 'error';

type ToastInput = {
  tone?: ToastTone;
  title: string;
  message?: string;
  durationMs?: number;
};

type ToastItem = Required<Pick<ToastInput, 'tone' | 'title' | 'durationMs'>> & {
  id: string;
  message?: string;
};

type ToastContextValue = {
  pushToast: (input: ToastInput) => string;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TECHNICAL_DETAIL = /(postgres|sqlstate|stack trace|bearer\s+|access[_ -]?token|refresh[_ -]?token|jwt|secret|password|\bat\s+\S+\s+\(.+:\d+:\d+\))/i;

function safeText(value: string | undefined, fallback: string, maxLength: number) {
  if (!value) return undefined;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  if (normalized.length > maxLength || TECHNICAL_DETAIL.test(normalized)) return fallback;
  return normalized;
}

function ToastCard({ toast, dismiss }: { toast: ToastItem; dismiss: (id: string) => void }) {
  useEffect(() => {
    if (toast.durationMs <= 0) return;
    const timer = window.setTimeout(() => dismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [dismiss, toast.durationMs, toast.id]);

  return (
    <div
      className={`${styles.toast} ${styles[toast.tone]}`}
      role={toast.tone === 'error' ? 'alert' : 'status'}
      aria-atomic="true"
    >
      <span className={styles.accent} aria-hidden="true" />
      <div className={styles.body}>
        <strong className={styles.title}>{toast.title}</strong>
        {toast.message ? <p className={styles.message}>{toast.message}</p> : null}
      </div>
      <button type="button" className={styles.close} aria-label="Fermer la notification" onClick={() => dismiss(toast.id)}>×</button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((input: ToastInput) => {
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tone = input.tone ?? 'info';
    const title = safeText(input.title, 'Notification FODIP', 90) ?? 'Notification FODIP';
    const message = safeText(input.message, 'Une information technique a été masquée. Réessayez ou contactez le support.', 260);
    const item: ToastItem = {
      id,
      tone,
      title,
      message,
      durationMs: input.durationMs ?? (tone === 'error' ? 7000 : 4500),
    };
    setToasts((current) => [...current.slice(-3), item]);
    return id;
  }, []);

  const value = useMemo(() => ({ pushToast, dismissToast }), [dismissToast, pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.viewport} aria-label="Notifications">
        {toasts.map((toast) => <ToastCard toast={toast} dismiss={dismissToast} key={toast.id} />)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
