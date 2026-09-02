'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import portal from '../../entrepreneur/portal.module.css';

type Role = { code: string; nom: string; description?: string; permissions: string[] };
type Enterprise = { id: string; codeFodip: string; raisonSociale: string };
type PartnerBank = { id: string; code: string; raisonSociale: string };
type User = {
  id: string; email: string; nom: string; prenom?: string; actif: boolean; mfaRequired: boolean; roles: string[];
  entrepriseId?: string | null; raisonSociale?: string;
  partenaireBancaireId?: string | null; partenaireRaisonSociale?: string; lastLoginAt?: string | null;
};

const emptyForm = { email: '', nom: '', prenom: '', password: '', roles: ['AGENT_FODIP'], entrepriseId: '', partenaireBancaireId: '', mfaRequired: false };

export default function UsersAdministrationPage() {
  const [users, setUsers] = useState<User[]>([]); const [roles, setRoles] = useState<Role[]>([]);
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]); const [partnerBanks, setPartnerBanks] = useState<PartnerBank[]>([]);
  const [form, setForm] = useState(emptyForm); const [search, setSearch] = useState(''); const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const [usersResponse, rolesResponse, enterprisesResponse, partnerBanksResponse] = await Promise.all([
      fetch(`/api/administration/users?search=${encodeURIComponent(search)}`, { cache: 'no-store' }),
      fetch('/api/administration/roles', { cache: 'no-store' }), fetch('/api/administration/enterprises', { cache: 'no-store' }),
      fetch('/api/administration/partner-banks', { cache: 'no-store' }),
    ]);
    const [usersBody, rolesBody, enterprisesBody, partnerBanksBody] = await Promise.all([
      usersResponse.json(), rolesResponse.json(), enterprisesResponse.json(), partnerBanksResponse.json(),
    ]);
    if (!usersResponse.ok) throw new Error(usersBody.message ?? 'Session administrateur requise');
    if (!rolesResponse.ok || !enterprisesResponse.ok || !partnerBanksResponse.ok) throw new Error('Référentiels indisponibles');
    setUsers(usersBody.items ?? []); setRoles(rolesBody.items ?? []);
    setEnterprises(enterprisesBody.items ?? []); setPartnerBanks(partnerBanksBody.items ?? []);
  }, [search]);

  useEffect(() => { load().catch((error) => setMessage(error.message)); }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault(); setMessage('');
    const response = await fetch('/api/administration/users', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...form, entrepriseId: form.entrepriseId || undefined, partenaireBancaireId: form.partenaireBancaireId || undefined }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(Array.isArray(body.message) ? body.message.join(' · ') : body.message ?? 'Création impossible');
    setMessage('Utilisateur créé et action enregistrée dans le journal d’audit.'); setForm(emptyForm); await load();
  }

  function patchLocal(id: string, values: Partial<User>) { setUsers((current) => current.map((item) => item.id === id ? { ...item, ...values } : item)); }
  async function save(user: User) {
    setMessage('');
    const response = await fetch(`/api/administration/users/${user.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        actif: user.actif, mfaRequired: user.mfaRequired, roles: user.roles,
        entrepriseId: user.entrepriseId || null, partenaireBancaireId: user.partenaireBancaireId || null,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(body.message ?? 'Mise à jour impossible'); return load(); }
    setMessage(`Compte ${user.email} mis à jour.`); await load();
  }

  return <main className={portal.main}><p className={portal.eyebrow}>Super administration</p><h1 className={portal.title}>Utilisateurs et rôles</h1>
    <p className={portal.lead}>Créez les comptes, attribuez leurs rôles et périmètres, activez ou suspendez les accès. La désactivation de son propre compte et du dernier super-administrateur est interdite.</p>
    {message && <div className={`${portal.notice} ${portal.section}`} role="status">{message}</div>}
    <section className={`${portal.card} ${portal.formCard} ${portal.section}`}><div className={portal.sectionHeader}><div><h2>Créer un utilisateur</h2><p>Le mot de passe initial respecte la politique forte et n’est jamais journalisé.</p></div></div>
      <form onSubmit={create}><div className={portal.formGrid}>
        <div className={portal.field}><label htmlFor="email">Email</label><input id="email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
        <div className={portal.field}><label htmlFor="password">Mot de passe initial</label><input id="password" type="password" minLength={12} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></div>
        <div className={portal.field}><label htmlFor="nom">Nom</label><input id="nom" required value={form.nom} onChange={(event) => setForm({ ...form, nom: event.target.value })} /></div>
        <div className={portal.field}><label htmlFor="prenom">Prénom</label><input id="prenom" value={form.prenom} onChange={(event) => setForm({ ...form, prenom: event.target.value })} /></div>
        <div className={portal.field}><label htmlFor="role">Rôle</label><select id="role" value={form.roles[0]} onChange={(event) => setForm({ ...form, roles: [event.target.value], entrepriseId: event.target.value === 'PME' ? form.entrepriseId : '', partenaireBancaireId: event.target.value === 'PARTENAIRE_BANCAIRE' ? form.partenaireBancaireId : '' })}>{roles.map((role) => <option key={role.code} value={role.code}>{role.nom}</option>)}</select></div>
        <div className={portal.field}><label htmlFor="entreprise">Entreprise PME</label><select id="entreprise" disabled={!form.roles.includes('PME')} required={form.roles.includes('PME')} value={form.entrepriseId} onChange={(event) => setForm({ ...form, entrepriseId: event.target.value })}><option value="">Sélectionner</option>{enterprises.map((enterprise) => <option key={enterprise.id} value={enterprise.id}>{enterprise.raisonSociale}</option>)}</select></div>
        <div className={portal.field}><label htmlFor="partenaire">Banque partenaire</label><select id="partenaire" disabled={!form.roles.includes('PARTENAIRE_BANCAIRE')} required={form.roles.includes('PARTENAIRE_BANCAIRE')} value={form.partenaireBancaireId} onChange={(event) => setForm({ ...form, partenaireBancaireId: event.target.value })}><option value="">Sélectionner</option>{partnerBanks.map((bank) => <option key={bank.id} value={bank.id}>{bank.raisonSociale}</option>)}</select></div>
      </div><div className={portal.buttonRow}><button className={portal.primary}>Créer le compte</button></div></form>
    </section>

    <section className={`${portal.card} ${portal.tableCard} ${portal.section}`}><div className={portal.sectionHeader}><div><h2>Comptes existants</h2><p>{users.length} compte{users.length === 1 ? '' : 's'} dans le périmètre.</p></div><div className={portal.field}><label htmlFor="search">Recherche</label><input id="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom ou email" /></div></div>
      <div style={{ overflowX: 'auto' }}><table className={portal.table}><thead><tr><th>Utilisateur</th><th>Rôles</th><th>Entreprise PME</th><th>Banque partenaire</th><th>Actif</th><th>MFA exigé</th><th>Action</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}>
        <td><strong>{user.prenom} {user.nom}</strong><br />{user.email}</td>
        <td><select multiple value={user.roles} aria-label={`Rôles de ${user.email}`} onChange={(event) => patchLocal(user.id, { roles: Array.from(event.target.selectedOptions, (option) => option.value) })}>{roles.map((role) => <option value={role.code} key={role.code}>{role.nom}</option>)}</select></td>
        <td><select value={user.entrepriseId ?? ''} disabled={!user.roles.includes('PME')} onChange={(event) => patchLocal(user.id, { entrepriseId: event.target.value || null })}><option value="">Aucune</option>{enterprises.map((enterprise) => <option key={enterprise.id} value={enterprise.id}>{enterprise.raisonSociale}</option>)}</select></td>
        <td><select value={user.partenaireBancaireId ?? ''} disabled={!user.roles.includes('PARTENAIRE_BANCAIRE')} onChange={(event) => patchLocal(user.id, { partenaireBancaireId: event.target.value || null })}><option value="">Aucune</option>{partnerBanks.map((bank) => <option key={bank.id} value={bank.id}>{bank.raisonSociale}</option>)}</select></td>
        <td><input type="checkbox" checked={user.actif} onChange={(event) => patchLocal(user.id, { actif: event.target.checked })} aria-label={`Compte actif ${user.email}`} /></td>
        <td><input type="checkbox" checked={user.mfaRequired} onChange={(event) => patchLocal(user.id, { mfaRequired: event.target.checked })} aria-label={`MFA ${user.email}`} /></td>
        <td><button className={portal.secondary} type="button" onClick={() => save(user)}>Enregistrer</button></td>
      </tr>)}</tbody></table></div>
    </section>
    <section className={`${portal.card} ${portal.section}`}><h2>Référentiel RBAC</h2>{roles.map((role) => <details key={role.code}><summary><strong>{role.nom}</strong> · {role.code}</summary><p>{role.description}</p><p>{role.permissions.join(' · ') || 'Aucune permission directe'}</p></details>)}</section>
  </main>;
}
