'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import ConfirmDialog from '../../_shared/ConfirmDialog';
import portal from '../../entrepreneur/portal.module.css';

type User = {
  id: string;
  email: string;
  nom: string;
  prenom?: string;
  actif: boolean;
  roles: string[];
  anonymizedAt?: string | null;
};

export default function AccountRecoveryPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<User | null>(null);

  const selected = useMemo(() => users.find((user) => user.id === selectedId) ?? null, [users, selectedId]);

  async function loadUsers() {
    const response = await fetch('/api/administration/users', { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message ?? 'Session administrateur requise');
    const items = (body.items ?? []) as User[];
    setUsers(items);
    setSelectedId((current) => current && items.some((user) => user.id === current) ? current : (items.find((user) => !user.anonymizedAt)?.id ?? ''));
  }

  useEffect(() => { loadUsers().catch((error) => setMessage(error.message)); }, []);

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    if (!selected) return setMessage('Sélectionnez un compte.');
    if (password !== confirmPassword) return setMessage('Les deux mots de passe ne correspondent pas.');
    setLoading(true);
    try {
      const response = await fetch(`/api/administration/users/${selected.id}/reset-password`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join(' · ') : body.message ?? 'Réinitialisation impossible');
      setPassword('');
      setConfirmPassword('');
      setMessage(`Mot de passe réinitialisé pour ${selected.email}. Le compte a été réactivé et l’action est journalisée.`);
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Réinitialisation impossible');
    } finally {
      setLoading(false);
    }
  }

  async function deleteAccess(user: User) {
    setMessage('');
    setLoading(true);
    try {
      const response = await fetch(`/api/data-rights/users/${user.id}/anonymize`, { method: 'POST' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? 'Suppression de l’accès impossible');
      setMessage(`Accès supprimé pour ${user.email}. Les données d’identité ont été anonymisées et la trace d’audit est conservée.`);
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Suppression de l’accès impossible');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={portal.main}>
      <p className={portal.eyebrow}>Super administration</p>
      <h1 className={portal.title}>Récupération et suppression des comptes</h1>
      <p className={portal.lead}>
        Réinitialisez un mot de passe sans connaître l’ancien, ou supprimez définitivement l’accès d’un utilisateur par anonymisation contrôlée. Les opérations sont réservées aux SUPER_ADMIN et journalisées.
      </p>

      {message && <div className={`${portal.notice} ${portal.section}`} role="status">{message}</div>}

      <section className={`${portal.card} ${portal.formCard} ${portal.section}`}>
        <div className={portal.sectionHeader}>
          <div>
            <h2>Récupérer un compte</h2>
            <p>Le nouveau mot de passe doit contenir au moins 12 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.</p>
          </div>
        </div>
        <form onSubmit={resetPassword}>
          <div className={portal.formGrid}>
            <div className={portal.field}>
              <label htmlFor="recovery-user">Compte</label>
              <select id="recovery-user" required value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                <option value="">Sélectionner un compte</option>
                {users.filter((user) => !user.anonymizedAt).map((user) => (
                  <option key={user.id} value={user.id}>{user.prenom ? `${user.prenom} ` : ''}{user.nom} · {user.email} · {user.roles.join(', ')}</option>
                ))}
              </select>
            </div>
            <div className={portal.field}>
              <label htmlFor="new-password">Nouveau mot de passe</label>
              <input id="new-password" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            <div className={portal.field}>
              <label htmlFor="confirm-password">Confirmer le mot de passe</label>
              <input id="confirm-password" type="password" autoComplete="new-password" minLength={12} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            </div>
          </div>
          <div className={portal.buttonRow}>
            <button className={portal.primary} disabled={loading || !selected}>{loading ? 'Traitement…' : 'Réinitialiser le mot de passe'}</button>
          </div>
        </form>
      </section>

      <section className={`${portal.card} ${portal.section}`}>
        <div className={portal.sectionHeader}>
          <div>
            <h2>Supprimer un accès</h2>
            <p>La suppression est logique et irréversible : le compte est désactivé et ses données directement identifiantes sont anonymisées, tandis que les obligations financières et d’audit restent conservées.</p>
          </div>
        </div>
        <div className={portal.tableCard} tabIndex={0} role="region" aria-label="Comptes supprimables">
          <table className={portal.table}>
            <thead><tr><th>Compte</th><th>Rôles</th><th>État</th><th>Action</th></tr></thead>
            <tbody>{users.map((user) => (
              <tr key={user.id}>
                <td><strong>{user.prenom} {user.nom}</strong><br /><small>{user.email}</small></td>
                <td>{user.roles.join(' · ') || '—'}</td>
                <td>{user.anonymizedAt ? 'Supprimé / anonymisé' : user.actif ? 'Actif' : 'Inactif'}</td>
                <td>
                  <button className={portal.secondary} type="button" disabled={loading || Boolean(user.anonymizedAt)} onClick={() => setPendingDelete(user)}>
                    {user.anonymizedAt ? 'Supprimé' : 'Supprimer l’accès'}
                  </button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Supprimer définitivement cet accès ?"
        message={pendingDelete ? `Le compte ${pendingDelete.email} sera désactivé et anonymisé. Cette action est irréversible. La suppression de votre propre compte et du dernier SUPER_ADMIN reste interdite.` : ''}
        confirmLabel="Supprimer l’accès"
        danger
        onConfirm={() => { const user = pendingDelete; setPendingDelete(null); if (user) void deleteAccess(user); }}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
  );
}
