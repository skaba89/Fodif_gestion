'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './ConfirmDialog.module.css';

/**
 * Mission "présentation Directeur général" (section 7): replaces `window.confirm()` and
 * `window.prompt()` - a native browser dialog can't be styled, isn't announced consistently to
 * screen readers, and blocks the whole tab (including any in-flight fetch's UI feedback) while
 * open. A controlled, accessible modal instead: focus trap + Escape-to-close + focus return, the
 * same contract Drawer.tsx already implements for the mobile nav, reused here for a centered
 * dialog rather than a slide-in panel.
 *
 * `requireComment` covers the `window.prompt()` case (agent/dossiers/[id]/page.tsx's rejection
 * comment) as one component rather than a second near-identical one: when set, `onConfirm`
 * receives the typed comment and the confirm button stays disabled until it's non-empty.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  danger = false,
  requireComment = false,
  commentLabel = 'Commentaire',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  requireComment?: boolean;
  commentLabel?: string;
  onConfirm: (comment?: string) => void;
  onCancel: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (open) setComment('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    returnFocusTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled])');
    focusable?.[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); onCancel(); return; }
      if (event.key !== 'Tab' || !focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusTo.current?.focus();
    };
  }, [open, onCancel]);

  if (!open) return null;
  const canConfirm = !requireComment || comment.trim().length > 0;

  return (
    <div className={styles.overlay}>
      <button type="button" className={styles.backdrop} aria-label="Annuler" onClick={onCancel} />
      <div ref={panelRef} role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" className={styles.panel}>
        <h2 id="confirm-dialog-title" className={styles.title}>{title}</h2>
        <p className={styles.message}>{message}</p>
        {requireComment && (
          <div className={styles.field}>
            <label htmlFor="confirm-dialog-comment">{commentLabel}</label>
            <textarea
              id="confirm-dialog-comment"
              required
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </div>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onCancel}>{cancelLabel}</button>
          <button
            type="button"
            className={danger ? styles.confirmDanger : styles.confirm}
            disabled={!canConfirm}
            onClick={() => onConfirm(requireComment ? comment.trim() : undefined)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
