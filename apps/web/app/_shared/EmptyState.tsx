import Link from 'next/link';
import styles from './EmptyState.module.css';

/**
 * Shared "nothing here" surface - mission "présentation Directeur général" (section 7). Backs
 * every portal segment's not-found.tsx, and available for any list/table that has real zero-rows
 * states to show honestly instead of an empty table.
 */
export default function EmptyState({
  title,
  message,
  actionHref,
  actionLabel,
}: {
  title: string;
  message: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className={styles.wrap}>
      <h2>{title}</h2>
      <p>{message}</p>
      {actionHref && actionLabel && <Link href={actionHref} className={styles.action}>{actionLabel}</Link>}
    </div>
  );
}
