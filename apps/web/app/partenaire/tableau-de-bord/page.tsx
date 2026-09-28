'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import Breadcrumbs from '../../_shared/Breadcrumbs';
import Button from '../../_shared/Button';
import KpiCard from '../../_shared/KpiCard';
import ResponsiveTable, { type ResponsiveColumn } from '../../_shared/ResponsiveTable';
import portal from '../../entrepreneur/portal.module.css';
import styles from '../../agent/agent.module.css';

type UpcomingInstallment = {
  id: string; numeroEcheance: number; dateEcheance: string; resteAPayer: number;
  financementId: string; numeroFinancement: string; raisonSociale: string;
};
type Dashboard = {
  financements: number; montantAccorde: number; montantDecaisse: number; montantRembourse: number; impayes: number;
  echeancesAVenir: UpcomingInstallment[];
};

function amount(value: number) { return Number(value).toLocaleString('fr-FR'); }
function displayDate(value: string) { return new Intl.DateTimeFormat('fr-FR').format(new Date(value)); }

export default function PartnerDashboardPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    fetch('/api/partenaire/dashboard', { cache: 'no-store' }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message ?? 'Chargement impossible');
      setDashboard(body);
    }).catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  const columns: ResponsiveColumn<UpcomingInstallment>[] = [
    {
      key: 'financement',
      header: 'Financement',
      render: (item) => <><strong>{item.numeroFinancement}</strong><br />{item.raisonSociale}</>,
    },
    { key: 'echeance', header: 'Échéance', render: (item) => <>N° {item.numeroEcheance} · {displayDate(item.dateEcheance)}</> },
    { key: 'reste', header: 'Reste à payer', render: (item) => `${amount(item.resteAPayer)} GNF` },
    { key: 'action', header: 'Action', render: (item) => <Button variant="outline" href={`/partenaire/financements/${item.financementId}`}>Ouvrir</Button> },
  ];

  return <main className={portal.main}>
    <Breadcrumbs items={[{ label: 'Partenaire bancaire', href: '/partenaire/tableau-de-bord' }, { label: 'Tableau de bord' }]} />
    <p className={portal.eyebrow}>Vue d’ensemble</p>
    <h1 className={portal.title}>Tableau de bord partenaire</h1>
    <p className={portal.lead}>Synthèse de l’ensemble de votre périmètre bancaire — financements en correspondance et portefeuille client — indépendamment de la pagination du portefeuille détaillé.</p>

    {message && <div className={`${portal.notice} ${portal.section}`} role="status">{message}</div>}

    {dashboard && <>
      <section className={styles.metrics} aria-label="Synthèse de l’ensemble du périmètre bancaire">
        <KpiCard label="Financements du périmètre" value={String(dashboard.financements)} definition="Nombre total de financements relevant de votre périmètre bancaire (correspondant désigné ou portefeuille client)." />
        <KpiCard label="Montant accordé" value={amount(dashboard.montantAccorde)} unit="GNF" definition="Somme des montants accordés sur l’ensemble de votre périmètre." />
        <KpiCard label="Montant décaissé" value={amount(dashboard.montantDecaisse)} unit="GNF" definition="Somme des décaissements effectués sur l’ensemble de votre périmètre." />
        <KpiCard label="Montant remboursé" value={amount(dashboard.montantRembourse)} unit="GNF" definition="Somme des remboursements collectés sur l’ensemble de votre périmètre." />
        <KpiCard label="Impayés" value={amount(dashboard.impayes)} unit="GNF" definition="Montant total dû sur les échéances déjà arrivées à terme et non intégralement remboursées." goodDirection="down" />
      </section>

      <section className={portal.section}>
        <div className={portal.sectionHeader}>
          <div>
            <h2>Échéances à venir</h2>
            <p>Les dix prochaines échéances non soldées de votre périmètre, triées par date.</p>
          </div>
          <div className={portal.buttonRow}>
            <Link className={portal.secondary} href="/partenaire/financements">Voir le portefeuille</Link>
            <Link className={portal.secondary} href="/partenaire/operations">Voir mes opérations</Link>
          </div>
        </div>
        <ResponsiveTable
          rows={dashboard.echeancesAVenir}
          columns={columns}
          rowKey={(item) => item.id}
          caption="Échéances à venir du périmètre partenaire"
          emptyMessage="Aucune échéance à venir n’est en attente de paiement."
        />
      </section>
    </>}
  </main>;
}
