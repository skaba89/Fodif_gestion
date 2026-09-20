'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Breadcrumbs from '../../_shared/Breadcrumbs';
import Button from '../../_shared/Button';
import FilterBar, { FilterField } from '../../_shared/FilterBar';
import Pagination from '../../_shared/Pagination';
import ResponsiveTable, { type ResponsiveColumn } from '../../_shared/ResponsiveTable';
import StatusBadge, { humanizeCode } from '../../_shared/StatusBadge';
import portal from '../../entrepreneur/portal.module.css';
import styles from '../utilisateurs/administration.module.css';

type AuditLog = { id: string; action: string; entityType: string; entityId?: string | null; createdAt: string; actorEmail?: string | null; actorNom?: string | null; actorPrenom?: string | null };
type Result = { items: AuditLog[]; total: number; page: number; limite: number };
const ADMIN_ACTIONS = ['CREATE_USER', 'UPDATE_USER', 'RESET_USER_PASSWORD', 'RESET_USER_MFA', 'ANONYMIZE_USER', 'CREATE_ENTERPRISE', 'CREATE_PARTNER_BANK'];

function actor(log: AuditLog) {
  const name = [log.actorPrenom, log.actorNom].filter(Boolean).join(' ');
  return name && log.actorEmail ? `${name} · ${log.actorEmail}` : name || log.actorEmail || 'Système';
}

export default function AdministrationAuditPage() {
  const [result, setResult] = useState<Result>({ items: [], total: 0, page: 1, limite: 25 });
  const [action, setAction] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async (page = 1, selectedAction = action) => {
    const query = new URLSearchParams({ page: String(page) });
    if (selectedAction) query.set('action', selectedAction);
    const response = await fetch(`/api/administration/audit?${query}`, { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.message ?? 'Chargement du journal impossible');
    setResult(body);
  }, [action]);
  useEffect(() => { load().catch((error) => setMessage(error.message)); }, [load]);
  function filter(event: FormEvent) { event.preventDefault(); setMessage(''); load(1).catch((error) => setMessage(error.message)); }
  const columns = useMemo<ResponsiveColumn<AuditLog>[]>(() => [
    { key: 'date', header: 'Date', render: (log) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(log.createdAt)) },
    { key: 'auteur', header: 'Administrateur', render: actor },
    { key: 'action', header: 'Action', render: (log) => <StatusBadge label={humanizeCode(log.action)} tone="info" title={log.action} /> },
    { key: 'cible', header: 'Cible', render: (log) => <>{humanizeCode(log.entityType)}{log.entityId ? <><br />ID {log.entityId.slice(0, 8)}…</> : null}</> },
  ], []);
  return <main className={`${portal.main} ${styles.auditPage}`}>
    <Breadcrumbs items={[{ label: 'Administration', href: '/administration/tableau-de-bord' }, { label: 'Journal' }]} />
    <p className={portal.eyebrow}>Traçabilité institutionnelle</p><h1 className={portal.title}>Journal des actions d’administration</h1><p className={portal.lead}>Consultez en lecture seule les actions sensibles, leur auteur, leur cible et leur horodatage.</p>
    {message ? <div className={`${portal.notice} ${portal.section}`} role="status">{message}</div> : null}
    <section className={portal.section}>
      <form onSubmit={filter}><FilterBar activeCount={Number(Boolean(action))} onReset={() => { setAction(''); setMessage(''); load(1, '').catch((error) => setMessage(error.message)); }} actions={<Button type="submit">Filtrer</Button>} ariaLabel="Filtres du journal d’administration"><FilterField label="Action" htmlFor="admin-action"><select id="admin-action" value={action} onChange={(event) => setAction(event.target.value)}><option value="">Toutes les actions</option>{ADMIN_ACTIONS.map((item) => <option key={item} value={item}>{humanizeCode(item)}</option>)}</select></FilterField></FilterBar></form>
      <div className={portal.section}><ResponsiveTable rows={result.items} columns={columns} rowKey={(log) => log.id} caption="Journal des actions d’administration" emptyMessage="Aucune action d’administration ne correspond au filtre." /></div>
      <Pagination page={result.page} limite={result.limite} total={result.total} onChange={(page) => load(page).catch((error) => setMessage(error.message))} buttonClassName={portal.secondary} rowClassName={portal.buttonRow} />
    </section>
  </main>;
}
