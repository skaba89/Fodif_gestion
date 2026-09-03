'use client';

import { useEffect, useRef } from 'react';
import { CloseIcon } from './Icons';
import styles from './Drawer.module.css';

/**
 * Generic accessible slide-in panel - mission "présentation Directeur général" (section 6, mobile
 * navigation) names this as one of the components to mutualize, and AppShell's mobile nav is its
 * first real user, but it takes no nav-specific props so any future "confirm this before you
 * leave" or "filters on mobile" panel can reuse it unmodified.
 *
 * Implements every behaviour the mission's navigation section calls out explicitly:
 *  - closes on Escape;
 *  - traps Tab/Shift+Tab focus inside the panel while open (a background link is never reachable
 *    by keyboard while the drawer covers it);
 *  - returns focus to whatever triggered it on close (the hamburger button, typically) rather
 *    than dropping focus back to <body>;
 *  - closes on a click on the backdrop, in addition to Escape and any in-panel close control.
 */
export default function Drawer({
  open,
  onClose,
  title,
  children,
  side = 'right',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  side?: 'left' | 'right';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    // Remember what had focus before the drawer opened (almost always the button that opened it)
    // so closing can put focus back there instead of losing it to <body>.
    returnFocusTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // no background scroll while the drawer covers the page
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusTo.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay}>
      <button type="button" className={styles.backdrop} aria-label="Fermer le menu" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`${styles.panel} ${side === 'left' ? styles.panelLeft : styles.panelRight}`}
      >
        <div className={styles.panelHeader}>
          <strong>{title}</strong>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Fermer">
            <CloseIcon aria-hidden />
          </button>
        </div>
        <div className={styles.panelBody}>{children}</div>
      </div>
    </div>
  );
}
