'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import portal from '../../entrepreneur/portal.module.css';

export default function AdministrationLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError('');
    try {
      const response = await fetch('/api/session/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? 'Connexion impossible');
      if (!(body.user?.roles ?? []).includes('SUPER_ADMIN')) {
        await fetch('/api/session/logout', { method: 'POST' }); throw new Error('Compte super-administrateur requis.');
      }
      router.replace('/administration/utilisateurs'); router.refresh();
    } catch (exception) { setError(exception instanceof Error ? exception.message : 'Connexion impossible'); }
    finally { setLoading(false); }
  }
  return <main className={portal.main}><section className={`${portal.card} ${portal.formCard}`} style={{ maxWidth: 560, margin: '50px auto' }}>
    <p className={portal.eyebrow}>Accès restreint</p><h1 className={portal.title}>Administration</h1><p className={portal.lead}>Gestion auditée des utilisateurs, rôles et périmètres PME.</p>
    <form onSubmit={submit}><div className={portal.formGrid}>
      <div className={`${portal.field} ${portal.fieldFull}`}><label htmlFor="email">Adresse email</label><input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
      <div className={`${portal.field} ${portal.fieldFull}`}><label htmlFor="password">Mot de passe</label><input id="password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
    </div>{error && <div className={portal.notice} role="alert">{error}</div>}<div className={portal.buttonRow}><button className={portal.primary} disabled={loading}>{loading ? 'Connexion…' : 'Se connecter'}</button></div></form>
  </section></main>;
}

