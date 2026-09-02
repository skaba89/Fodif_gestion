'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from '../../entrepreneur/portal.module.css';

type Session = { email: string };

export function CommitteeAccountMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  // Re-check on every navigation within the portal, not just on mount: this component stays
  // mounted across the connexion -> dashboard transition (same layout), so a mount-only fetch
  // would keep showing "logged out" right after a successful login.
  useEffect(() => {
    fetch('/api/session/me', { cache: 'no-store' })
      .then(async (response) => response.ok ? response.json() : null)
      .then(setSession)
      .catch(() => setSession(null));
  }, [pathname]);
  async function logout() {
    await fetch('/api/session/logout', { method: 'POST' });
    router.replace('/comite/connexion');
    router.refresh();
  }
  if (!session) return <Link className={styles.secondary} href="/comite/connexion">Connexion comité</Link>;
  return <div className={styles.account}><span>{session.email}</span><button className={styles.secondary} type="button" onClick={logout}>Déconnexion</button></div>;
}
