'use client';

import Link from 'next/link';
import type { MouseEvent, ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';

type ButtonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  href?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  loading?: boolean;
  success?: boolean;
  iconOnly?: boolean;
  className?: string;
  ariaLabel?: string;
  title?: string;
  onClick?: () => void;
};

function SuccessIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path d="M3.5 8.25 6.5 11 12.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Button({
  children,
  variant = 'primary',
  href,
  type = 'button',
  disabled = false,
  loading = false,
  success = false,
  iconOnly = false,
  className = '',
  ariaLabel,
  title,
  onClick,
}: ButtonProps) {
  const unavailable = disabled || loading;
  const classes = [
    styles.button,
    styles[variant],
    loading ? styles.loading : '',
    success ? styles.success : '',
    iconOnly ? styles.iconOnly : '',
    className,
  ].filter(Boolean).join(' ');
  const content = (
    <>
      {loading ? <span className={styles.loadingBar} aria-hidden="true" /> : null}
      {success ? <span className={styles.successIcon}><SuccessIcon /></span> : null}
      <span>{children}</span>
    </>
  );

  if (href) {
    function handleLinkClick(event: MouseEvent<HTMLAnchorElement>) {
      if (unavailable) {
        event.preventDefault();
        return;
      }
      onClick?.();
    }

    return (
      <Link
        href={href}
        className={classes}
        aria-label={ariaLabel}
        aria-disabled={unavailable || undefined}
        tabIndex={unavailable ? -1 : undefined}
        title={title}
        onClick={handleLinkClick}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={unavailable}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      title={title}
      onClick={onClick}
    >
      {content}
    </button>
  );
}
