'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from '../../entrepreneur/portal.module.css';

type Session = { email: string };

export function PartenaireAccountMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    fetch('/api/session/me', { cache: 'no-store' })
      .then(async (response) => response.ok ? response.json() : null)
      .then(setSession)
      .catch(() => setSession(null));
  }, [pathname]);
  async function logout() {
    await fetch('/api/session/logout', { method: 'POST' });
    router.replace('/partenaire/connexion');
    router.refresh();
  }
  if (!session) return <Link className={styles.secondary} href="/partenaire/connexion">Connexion partenaire</Link>;
  return <div className={styles.account}><span>{session.email}</span><button className={styles.secondary} type="button" onClick={logout}>Déconnexion</button></div>;
}
