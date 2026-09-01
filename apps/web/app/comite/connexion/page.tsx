'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../entrepreneur/portal.module.css';

export default function CommitteeLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError('');
    try {
      const response = await fetch('/api/session/login', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? 'Connexion impossible');
      const roles: string[] = data.user?.roles ?? [];
      if (!roles.some((role) => ['COMITE_FINANCEMENT', 'SUPER_ADMIN'].includes(role))) {
        await fetch('/api/session/logout', { method: 'POST' });
        throw new Error('Ce compte ne possède pas le rôle Comité de financement.');
      }
      router.push('/comite/dossiers'); router.refresh();
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Connexion impossible');
    } finally { setLoading(false); }
  }

  return <main className={styles.main}>
    <p className={styles.eyebrow}>Décision collégiale</p><h1 className={styles.title}>Connexion Comité</h1>
    <p className={styles.lead}>Accès réservé aux membres autorisés. Le score éclaire la décision mais ne la remplace jamais.</p>
    <form className={`${styles.card} ${styles.formCard} ${styles.section}`} onSubmit={submit}>
      <div className={styles.formGrid}>
        <div className={`${styles.field} ${styles.fieldFull}`}><label>Email</label><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
        <div className={`${styles.field} ${styles.fieldFull}`}><label>Mot de passe</label><input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
      </div>
      {error && <div className={styles.notice}>{error}</div>}
      <div className={styles.buttonRow}><button className={styles.primary} disabled={loading}>{loading ? 'Connexion…' : 'Se connecter'}</button></div>
    </form>
  </main>;
}
