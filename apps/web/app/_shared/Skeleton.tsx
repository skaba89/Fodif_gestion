import styles from './Skeleton.module.css';

/** Loading placeholder - mission "présentation Directeur général" (section 7). Used by every
 * portal segment's loading.tsx (Next.js route-level Suspense boundary) instead of a blank page
 * while server data loads. */
export default function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className={styles.wrap} role="status" aria-label="Chargement en cours">
      <div className={styles.block} />
      <div className={styles.grid}>
        {Array.from({ length: lines }).map((_, index) => <div key={index} className={styles.line} />)}
      </div>
    </div>
  );
}
