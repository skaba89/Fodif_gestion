'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import ConfirmDialog from '../../_shared/ConfirmDialog';
import portal from '../../entrepreneur/portal.module.css';
import styles from './administration.module.css';

type Role = { code: string; nom: string; description?: string; permissions: string[] };
type Enterprise = { id: string; codeFodip: string; raisonSociale: string };
type PartnerBank = { id: string; code: string; raisonSociale: string };
type User = {
  id: string; email: string; nom: string; prenom?: string; actif: boolean; mfaRequired: boolean; roles: string[];
  entrepriseId?: string | null; raisonSociale?: string;
  partenaireBancaireId?: string | null; partenaireRaisonSociale?: string; lastLoginAt?: string | null;
  anonymizedAt?: string | null;
};

const emptyForm = { email: '', nom: '', prenom: '', password: '', roles: ['AGENT_FODIP'], entrepriseId: '', partenaireBancaireId: '', mfaRequired: false };
const emptyEnterpriseForm = { codeFodip: '', raisonSociale: '', nomCommercial: '' };
const emptyPartnerBankForm = { code: '', raisonSociale: '' };

function responseMessage(body: { message?: string | string[] }, fallback: string) {
  return Array.isArray(body.message) ? body.message.join(' · ') : body.message ?? fallback;
}

function userInitials(user: User) {
  const initials = `${user.prenom?.[0] ?? ''}${user.nom?.[0] ?? ''}`.trim().toUpperCase();
  return initials || user.email[0]?.toUpperCase() || 'U';
}

export default function UsersAdministrationPage() {
  const [users, setUsers] = useState<User[]>([]); const [roles, setRoles] = useState<Role[]>([]);
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]); const [partnerBanks, setPartnerBanks] = useState<PartnerBank[]>([]);
  const [form, setForm] = useState(emptyForm); const [search, setSearch] = useState(''); const [message, setMessage] = useState('');
  const [enterpriseForm, setEnterpriseForm] = useState(emptyEnterpriseForm);
  const [partnerBankForm, setPartnerBankForm] = useState(emptyPartnerBankForm);
  const [pendingAnonymize, setPendingAnonymize] = useState<User | null>(null);

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

  async function createEnterprise(event: FormEvent) {
    event.preventDefault(); setMessage('');
    const response = await fetch('/api/administration/enterprises', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(enterpriseForm),
    });
    const body = await response.json().catch(() => ({})) as Enterprise & { message?: string | string[] };
    if (!response.ok) return setMessage(responseMessage(body, 'Création de la PME impossible'));
    setEnterpriseForm(emptyEnterpriseForm);
    setForm((current) => ({ ...current, roles: ['PME'], entrepriseId: body.id, partenaireBancaireId: '' }));
    setMessage(`PME ${body.raisonSociale} créée. Elle est déjà sélectionnée pour le prochain compte PME.`);
    await load();
  }

  async function createPartnerBank(event: FormEvent) {
    event.preventDefault(); setMessage('');
    const response = await fetch('/api/administration/partner-banks', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(partnerBankForm),
    });
    const body = await response.json().catch(() => ({})) as PartnerBank & { message?: string | string[] };
    if (!response.ok) return setMessage(responseMessage(body, 'Création de la banque partenaire impossible'));
    setPartnerBankForm(emptyPartnerBankForm);
    setForm((current) => ({ ...current, roles: ['PARTENAIRE_BANCAIRE'], partenaireBancaireId: body.id, entrepriseId: '' }));
    setMessage(`Banque partenaire ${body.raisonSociale} créée. Elle est déjà sélectionnée pour le prochain compte partenaire.`);
    await load();
  }

  async function create(event: FormEvent) {
    event.preventDefault(); setMessage('');
    const response = await fetch('/api/administration/users', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...form, entrepriseId: form.entrepriseId || undefined, partenaireBancaireId: form.partenaireBancaireId || undefined }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(responseMessage(body, 'Création impossible'));
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

  async function anonymize(user: User) {
    setMessage('');
    const response = await fetch(`/api/data-rights/users/${user.id}/anonymize`, { method: 'POST' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(body.message ?? 'Anonymisation impossible');
    setMessage(`Compte ${user.email} anonymisé.`); await load();
  }

  const activeUsers = users.filter((user) => user.actif).length;
  const mfaUsers = users.filter((user) => user.mfaRequired).length;

  return <main className={`${portal.main} ${styles.adminPage}`}>
    <div className={styles.pageHeader}>
      <div className={styles.headerCopy}>
        <p className={portal.eyebrow}>Super administration</p>
        <h1 className={portal.title}>Utilisateurs et rôles</h1>
        <p className={portal.lead}>Créez les PME et banques partenaires, puis les comptes utilisateurs et leurs périmètres. La désactivation de son propre compte et du dernier super-administrateur est interdite.</p>
      </div>
      <span className={styles.securityBadge}><span className={styles.securityDot} aria-hidden="true" />Accès SUPER_ADMIN · actions journalisées</span>
    </div>

    <section className={styles.statsGrid} aria-label="Synthèse de l’administration">
      <article className={styles.statCard}><span className={styles.statLabel}>Comptes actifs</span><strong className={styles.statValue}>{activeUsers}</strong><span className={styles.statMeta}>{users.length} compte{users.length === 1 ? '' : 's'} visible{users.length === 1 ? '' : 's'} dans le filtre courant</span></article>
      <article className={styles.statCard}><span className={styles.statLabel}>PME référencées</span><strong className={styles.statValue}>{enterprises.length}</strong><span className={styles.statMeta}>Entreprises disponibles pour rattachement</span></article>
      <article className={styles.statCard}><span className={styles.statLabel}>Banques partenaires</span><strong className={styles.statValue}>{partnerBanks.length}</strong><span className={styles.statMeta}>Partenaires bancaires disponibles</span></article>
      <article className={styles.statCard}><span className={styles.statLabel}>MFA exigé</span><strong className={styles.statValue}>{mfaUsers}</strong><span className={styles.statMeta}>Comptes visibles soumis à la double authentification</span></article>
    </section>

    {message && <div className={`${portal.notice} ${portal.section} ${styles.flash}`} role="status">{message}</div>}

    <section className={`${portal.card} ${portal.section} ${styles.referenceSection}`}>
      <div className={styles.sectionIntro}><h2>Référentiels d’accès</h2><p>Créez d’abord l’organisation à laquelle le futur compte sera rattaché. Le référentiel créé est automatiquement présélectionné pour l’étape suivante.</p></div>
      <div className={styles.referenceGrid}>
        <div className={styles.referenceCard}>
          <span className={styles.referenceKicker}>PME</span>
          <h3>Nouvelle entreprise</h3>
          <p>Enregistrez la structure bénéficiaire avant de créer son accès au portail entrepreneur.</p>
          <form onSubmit={createEnterprise}>
            <div className={portal.formGrid}>
              <div className={portal.field}><label htmlFor="enterprise-code">Code FODIP</label><input id="enterprise-code" required maxLength={30} value={enterpriseForm.codeFodip} onChange={(event) => setEnterpriseForm({ ...enterpriseForm, codeFodip: event.target.value })} placeholder="PME-0001" /></div>
              <div className={portal.field}><label htmlFor="enterprise-name">Raison sociale</label><input id="enterprise-name" required maxLength={255} value={enterpriseForm.raisonSociale} onChange={(event) => setEnterpriseForm({ ...enterpriseForm, raisonSociale: event.target.value })} /></div>
              <div className={`${portal.field} ${portal.fieldFull}`}><label htmlFor="enterprise-trade-name">Nom commercial</label><input id="enterprise-trade-name" maxLength={255} value={enterpriseForm.nomCommercial} onChange={(event) => setEnterpriseForm({ ...enterpriseForm, nomCommercial: event.target.value })} /></div>
            </div>
            <div className={portal.buttonRow}><button className={portal.secondary}>Créer la PME</button></div>
          </form>
        </div>

        <div className={styles.referenceCard}>
          <span className={styles.referenceKicker}>Partenaire financier</span>
          <h3>Nouvelle banque partenaire</h3>
          <p>Ajoutez l’établissement partenaire avant de créer son compte et son périmètre de consultation.</p>
          <form onSubmit={createPartnerBank}>
            <div className={portal.formGrid}>
              <div className={portal.field}><label htmlFor="bank-code">Code banque</label><input id="bank-code" required maxLength={50} value={partnerBankForm.code} onChange={(event) => setPartnerBankForm({ ...partnerBankForm, code: event.target.value })} placeholder="BANK-01" /></div>
              <div className={portal.field}><label htmlFor="bank-name">Raison sociale</label><input id="bank-name" required maxLength={255} value={partnerBankForm.raisonSociale} onChange={(event) => setPartnerBankForm({ ...partnerBankForm, raisonSociale: event.target.value })} /></div>
            </div>
            <div className={portal.buttonRow}><button className={portal.secondary}>Créer la banque partenaire</button></div>
          </form>
        </div>
      </div>
    </section>

    <section className={`${portal.card} ${portal.formCard} ${portal.section} ${styles.userSection}`}>
      <div className={styles.userSectionHeader}>
        <div><h2>Créer un utilisateur</h2><p>Définissez l’identité, le rôle et le périmètre. Le mot de passe initial respecte la politique forte et n’est jamais journalisé.</p></div>
        <span className={styles.policyBadge}>Politique forte · 12 caractères minimum</span>
      </div>
      <form onSubmit={create}>
        <div className={portal.formGrid}>
          <div className={portal.field}><label htmlFor="email">Email</label><input id="email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
          <div className={portal.field}><label htmlFor="password">Mot de passe initial</label><input id="password" type="password" minLength={12} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></div>
          <div className={portal.field}><label htmlFor="nom">Nom</label><input id="nom" required value={form.nom} onChange={(event) => setForm({ ...form, nom: event.target.value })} /></div>
          <div className={portal.field}><label htmlFor="prenom">Prénom</label><input id="prenom" value={form.prenom} onChange={(event) => setForm({ ...form, prenom: event.target.value })} /></div>
          <div className={portal.field}><label htmlFor="role">Rôle</label><select id="role" value={form.roles[0]} onChange={(event) => setForm({ ...form, roles: [event.target.value], entrepriseId: event.target.value === 'PME' ? form.entrepriseId : '', partenaireBancaireId: event.target.value === 'PARTENAIRE_BANCAIRE' ? form.partenaireBancaireId : '' })}>{roles.map((role) => <option key={role.code} value={role.code}>{role.nom}</option>)}</select></div>
          <div className={portal.field}><label htmlFor="entreprise">Entreprise PME</label><select id="entreprise" disabled={!form.roles.includes('PME')} required={form.roles.includes('PME')} value={form.entrepriseId} onChange={(event) => setForm({ ...form, entrepriseId: event.target.value })}><option value="">Sélectionner</option>{enterprises.map((enterprise) => <option key={enterprise.id} value={enterprise.id}>{enterprise.raisonSociale} · {enterprise.codeFodip}</option>)}</select></div>
          <div className={portal.field}><label htmlFor="partenaire">Banque partenaire</label><select id="partenaire" disabled={!form.roles.includes('PARTENAIRE_BANCAIRE')} required={form.roles.includes('PARTENAIRE_BANCAIRE')} value={form.partenaireBancaireId} onChange={(event) => setForm({ ...form, partenaireBancaireId: event.target.value })}><option value="">Sélectionner</option>{partnerBanks.map((bank) => <option key={bank.id} value={bank.id}>{bank.raisonSociale} · {bank.code}</option>)}</select></div>
        </div>
        <div className={portal.buttonRow}><button className={portal.primary}>Créer le compte</button></div>
      </form>
    </section>

    <section className={`${portal.card} ${portal.tableCard} ${portal.section} ${styles.usersSection}`} tabIndex={0} role="region" aria-label="Tableau, défilement horizontal sur petit écran">
      <div className={styles.tableToolbar}>
        <div><h2>Comptes existants</h2><p>Pilotez les rôles, périmètres, états de compte et exigences MFA depuis une vue consolidée.</p></div>
        <div className={`${portal.field} ${styles.searchField}`}><label htmlFor="search">Rechercher un compte</label><input id="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom ou email" /></div>
      </div>
      <div className={styles.tableScroller}><table className={portal.table}><thead><tr><th>Utilisateur</th><th>Rôles</th><th>Entreprise PME</th><th>Banque partenaire</th><th>Actif</th><th>MFA exigé</th><th>Action</th><th>Droits des personnes</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}>
        <td><div className={styles.userIdentity}><span className={styles.userAvatar} aria-hidden="true">{userInitials(user)}</span><div><strong>{user.prenom} {user.nom}</strong><span className={styles.userEmail}>{user.email}</span></div></div></td>
        <td><select multiple value={user.roles} aria-label={`Rôles de ${user.email}`} onChange={(event) => patchLocal(user.id, { roles: Array.from(event.target.selectedOptions, (option) => option.value) })}>{roles.map((role) => <option value={role.code} key={role.code}>{role.nom}</option>)}</select></td>
        <td><select value={user.entrepriseId ?? ''} disabled={!user.roles.includes('PME')} onChange={(event) => patchLocal(user.id, { entrepriseId: event.target.value || null })}><option value="">Aucune</option>{enterprises.map((enterprise) => <option key={enterprise.id} value={enterprise.id}>{enterprise.raisonSociale}</option>)}</select></td>
        <td><select value={user.partenaireBancaireId ?? ''} disabled={!user.roles.includes('PARTENAIRE_BANCAIRE')} onChange={(event) => patchLocal(user.id, { partenaireBancaireId: event.target.value || null })}><option value="">Aucune</option>{partnerBanks.map((bank) => <option key={bank.id} value={bank.id}>{bank.raisonSociale}</option>)}</select></td>
        <td className={styles.toggleCell}><input type="checkbox" checked={user.actif} onChange={(event) => patchLocal(user.id, { actif: event.target.checked })} aria-label={`Compte actif ${user.email}`} /></td>
        <td className={styles.toggleCell}><input type="checkbox" checked={user.mfaRequired} onChange={(event) => patchLocal(user.id, { mfaRequired: event.target.checked })} aria-label={`MFA ${user.email}`} /></td>
        <td><button className={`${portal.secondary} ${styles.actionButton}`} type="button" onClick={() => save(user)}>Enregistrer</button></td>
        <td><button className={`${portal.secondary} ${styles.dangerAction}`} type="button" onClick={() => setPendingAnonymize(user)} disabled={Boolean(user.anonymizedAt)}>{user.anonymizedAt ? 'Anonymisé' : 'Anonymiser'}</button></td>
      </tr>)}</tbody></table></div>
    </section>

    <section className={`${portal.card} ${portal.section} ${styles.rbacSection}`}>
      <div className={styles.rbacHeader}><h2>Référentiel RBAC</h2><p>Consultez les rôles disponibles et les permissions directes associées.</p></div>
      <div className={styles.roleGrid}>{roles.map((role) => <details className={styles.roleDetails} key={role.code}><summary><strong>{role.nom}</strong> · {role.code}</summary><div className={styles.roleBody}><p>{role.description}</p><p>{role.permissions.join(' · ') || 'Aucune permission directe'}</p></div></details>)}</div>
    </section>

    <ConfirmDialog
      open={Boolean(pendingAnonymize)}
      title="Anonymiser ce compte ?"
      message={pendingAnonymize ? `Anonymiser le compte ${pendingAnonymize.email} ? Cette action est irréversible : le nom, prénom, téléphone et email seront remplacés par un repère non identifiant et le compte sera désactivé.` : ''}
      confirmLabel="Anonymiser"
      danger
      onConfirm={() => { const user = pendingAnonymize; setPendingAnonymize(null); if (user) void anonymize(user); }}
      onCancel={() => setPendingAnonymize(null)}
    />
  </main>;
}
