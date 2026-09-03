'use client';

import { AlertTriangleIcon } from './Icons';
import styles from './ErrorState.module.css';

/**
 * Shared error surface - mission "présentation Directeur général" (section 7): backs every
 * portal segment's error.tsx (Next.js route-level error boundary). `reset` is Next's own retry
 * callback for the boundary; a genuine "réessayer" action, not a page reload.
 */
export default function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className={styles.wrap} role="alert">
      <AlertTriangleIcon aria-hidden />
      <h2>Une erreur est survenue</h2>
      <p>{message || 'Impossible d’afficher cette page pour le moment. Réessayez dans quelques instants.'}</p>
      {onRetry && <button type="button" className={styles.retry} onClick={onRetry}>Réessayer</button>}
    </div>
  );
}
