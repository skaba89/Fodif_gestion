'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './InstitutionalFlow.module.css';

export default function ConnectivityBanner() {
  const [online, setOnline] = useState(true);
  const [showRecovered, setShowRecovered] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    const update = () => {
      const nextOnline = navigator.onLine;
      if (!nextOnline) {
        wasOffline.current = true;
        setShowRecovered(false);
      } else if (wasOffline.current) {
        setShowRecovered(true);
        window.setTimeout(() => setShowRecovered(false), 4000);
        wasOffline.current = false;
      }
      setOnline(nextOnline);
    };

    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (online && !showRecovered) return null;

  return (
    <div
      className={`${styles.connectivity} ${online ? styles.connectivityOnline : ''}`}
      role="status"
      aria-live="polite"
      data-testid="connectivity-banner"
    >
      <span className={styles.connectivityDot} aria-hidden="true" />
      <span>
        {online
          ? 'Connexion rétablie. Les données affichées peuvent maintenant être actualisées.'
          : 'Vous êtes hors connexion. Les actions sensibles restent désactivées jusqu’au retour du réseau.'}
      </span>
    </div>
  );
}
