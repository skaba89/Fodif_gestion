'use client';

import { useEffect, useState } from 'react';
import styles from './hors-ligne.module.css';

// Axe D2 (docs/14-ROADMAP-SAAS-PREMIUM.md) - offline fallback shell, served by the service
// worker (public/sw.js) when a navigation fails with no network. No data fetching, no
// server-only content: this page must render correctly with nothing but what the service
// worker cached at install time.
export default function OfflinePage() {
  // Reflects the live connectivity state so the page updates itself the moment the browser
  // regains a network path, without waiting for a manual retry.
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline = () => {
      setIsOnline(true);
      // The connection is back: reload immediately so the visitor lands on the page they
      // actually wanted rather than staying stuck on this shell.
      window.location.reload();
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return (
    <main className={styles.shell}>
      <div className={styles.card}>
        <span className={styles.mark}>FD</span>
        <h1 className={styles.title}>Vous êtes hors ligne</h1>
        <p className={styles.lead}>
          Cette page nécessite une connexion. FODIP Digital 2030 se recharge automatiquement dès
          que la connexion revient — vous pouvez aussi réessayer maintenant.
        </p>
        <p className={styles.status}>
          <span className={styles.dot} aria-hidden="true" />
          {isOnline === false ? 'Aucune connexion détectée' : 'Vérification de la connexion…'}
        </p>
        <div>
          <button type="button" className={styles.retry} onClick={() => window.location.reload()}>
            Réessayer
          </button>
        </div>
      </div>
    </main>
  );
}
