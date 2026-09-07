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
  iconOnly?: boolean;
  className?: string;
  ariaLabel?: string;
  title?: string;
  onClick?: () => void;
};

export default function Button({
  children,
  variant = 'primary',
  href,
  type = 'button',
  disabled = false,
  loading = false,
  iconOnly = false,
  className = '',
  ariaLabel,
  title,
  onClick,
}: ButtonProps) {
  const unavailable = disabled || loading;
  const classes = [styles.button, styles[variant], iconOnly ? styles.iconOnly : '', className]
    .filter(Boolean)
    .join(' ');
  const content = (
    <>
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
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
