'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../entrepreneur/portal.module.css';

export default function AgentLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/session/login', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? 'Connexion impossible');
      const roles: string[] = data.user?.roles ?? [];
      if (!roles.some((role) => ['AGENT_FODIP', 'SUPER_ADMIN'].includes(role))) {
        await fetch('/api/session/logout', { method: 'POST' });
        throw new Error('Ce compte ne possède pas le rôle Agent FODIP.');
      }
      router.push('/agent/dossiers');
      router.refresh();
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Connexion impossible');
    } finally {
      setLoading(false);
    }
  }

  return <main className={styles.main}>
    <p className={styles.eyebrow}>Instruction FODIP</p><h1 className={styles.title}>Connexion Agent</h1>
    <p className={styles.lead}>Accès réservé aux agents autorisés chargés d’instruire et de vérifier les dossiers.</p>
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
