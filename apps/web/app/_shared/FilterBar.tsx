'use client';

import type { ReactNode } from 'react';
import Button from './Button';
import styles from './FilterBar.module.css';

export function FilterField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

export default function FilterBar({
  children,
  activeCount = 0,
  onReset,
  actions,
  ariaLabel = 'Filtres',
}: {
  children: ReactNode;
  activeCount?: number;
  onReset?: () => void;
  actions?: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <div className={styles.bar} role="group" aria-label={ariaLabel}>
      <div className={styles.fields}>{children}</div>
      <div className={styles.actions}>
        <span className={styles.count} aria-live="polite">
          {activeCount === 0 ? 'Aucun filtre actif' : `${activeCount} filtre${activeCount > 1 ? 's' : ''} actif${activeCount > 1 ? 's' : ''}`}
        </span>
        {onReset ? <Button variant="ghost" onClick={onReset}>Réinitialiser</Button> : null}
        {actions}
      </div>
    </div>
  );
}
