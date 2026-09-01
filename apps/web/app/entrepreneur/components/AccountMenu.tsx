'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from '../portal.module.css';
type Session = { email: string };
export function AccountMenu() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => { fetch('/api/session/me', { cache: 'no-store' }).then(async (response) => response.ok ? response.json() : null).then(setSession).catch(() => setSession(null)); }, []);
  async function logout() { await fetch('/api/session/logout', { method: 'POST' }); router.replace('/entrepreneur/connexion'); router.refresh(); }
  if (!session) return <Link className={styles.secondary} href="/entrepreneur/connexion">Connexion</Link>;
  return <div className={styles.account}><span>{session.email}</span><button className={styles.secondary} type="button" onClick={logout}>Déconnexion</button></div>;
}
