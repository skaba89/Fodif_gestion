'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Breadcrumbs from '../../_shared/Breadcrumbs';
import Button from '../../_shared/Button';
import Pagination from '../../_shared/Pagination';
import ResponsiveTable, { type ResponsiveColumn } from '../../_shared/ResponsiveTable';
import StatusBadge, { humanizeCode } from '../../_shared/StatusBadge';
import portal from '../../entrepreneur/portal.module.css';

type Operation = {
  id: string; action: string; entityType: string; entityId: string; createdAt: string;
  newValues: { montant?: number; numero?: number; echeanceId?: string; datePaiement?: string };
  financementId: string; numeroFinancement: string; raisonSociale: string;
};
type Result = { items: Operation[]; total: number; page: number; limite: number };

const ACTION_LABELS: Record<string, string> = {
  PARTNER_DECLARE_DISBURSEMENT: 'Décaissement déclaré',
  PARTNER_DECLARE_REPAYMENT: 'Remboursement déclaré',
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function PartnerOperationsPage() {
  const [result, setResult] = useState<Result>({ items: [], total: 0, page: 1, limite: 25 });
  const [message, setMessage] = useState('');

  const load = useCallback((page: number) => {
    fetch(`/api/partenaire/operations?page=${page}`, { cache: 'no-store' }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message ?? 'Chargement impossible');
      setResult(body);
    }).catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => { load(1); }, [load]);

  const columns = useMemo<ResponsiveColumn<Operation>[]>(() => [
    { key: 'date', header: 'Date', render: (item) => formatDate(item.createdAt) },
    { key: 'type', header: 'Opération', render: (item) => <StatusBadge label={ACTION_LABELS[item.action] ?? humanizeCode(item.action)} tone="info" title={item.action} /> },
    {
      key: 'financement',
      header: 'Financement',
      render: (item) => <><strong>{item.numeroFinancement}</strong><br />{item.raisonSociale}</>,
    },
    { key: 'montant', header: 'Montant', render: (item) => item.newValues.montant ? `${Number(item.newValues.montant).toLocaleString('fr-FR')} GNF` : '—' },
    { key: 'action', header: 'Action', render: (item) => <Button variant="outline" href={`/partenaire/financements/${item.financementId}`}>Voir le financement</Button> },
  ], []);

  return <main className={portal.main}>
    <Breadcrumbs items={[{ label: 'Partenaire bancaire', href: '/partenaire/tableau-de-bord' }, { label: 'Mes opérations' }]} />
    <p className={portal.eyebrow}>Historique</p>
    <h1 className={portal.title}>Mes opérations déclarées</h1>
    <p className={portal.lead}>Retrouvez chaque décaissement et remboursement que votre établissement a déclaré via ce portail, avec la date exacte de la déclaration.</p>

    {message && <div className={`${portal.notice} ${portal.section}`} role="status">{message}</div>}

    <section className={portal.section}>
      <ResponsiveTable
        rows={result.items}
        columns={columns}
        rowKey={(item) => item.id}
        caption="Opérations déclarées par le partenaire bancaire"
        emptyMessage="Aucune opération n’a encore été déclarée par votre établissement."
      />
      <Pagination page={result.page} limite={result.limite} total={result.total} onChange={load} buttonClassName={portal.secondary} rowClassName={portal.buttonRow} />
    </section>
  </main>;
}
