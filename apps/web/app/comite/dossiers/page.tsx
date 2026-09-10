'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Breadcrumbs from '../../_shared/Breadcrumbs';
import Button from '../../_shared/Button';
import KpiCard from '../../_shared/KpiCard';
import Pagination from '../../_shared/Pagination';
import ResponsiveTable, { type ResponsiveColumn } from '../../_shared/ResponsiveTable';
import { RiskBadge } from '../../_shared/StatusBadge';
import portal from '../../entrepreneur/portal.module.css';
import styles from '../../agent/agent.module.css';

type Item = { id: string; numeroDossier: string; raisonSociale: string; programmeNom?: string; montantDemande: number | string; scoreTotal?: number | string; niveauRisque?: string; recommandation?: string };
type Result = { items: Item[]; total: number; page: number; limite: number };

function scoreLabel(value?: number | string) {
  return value === undefined || value === null || value === '' ? '—' : `${value}/100`;
}

export default function CommitteeApplicationsPage() {
  const [result, setResult] = useState<Result>({ items: [], total: 0, page: 1, limite: 25 });
  const [message, setMessage] = useState('');

  const load = useCallback((page: number) => {
    fetch(`/api/comite/dossiers?page=${page}`, { cache: 'no-store' }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message ?? 'Chargement impossible');
      setResult(body);
    }).catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => { load(1); }, [load]);
  const { items } = result;
  const amount = items.reduce((sum, item) => sum + Number(item.montantDemande), 0);
  const lowRiskCount = items.filter((item) => item.niveauRisque === 'FAIBLE').length;
  const highRiskCount = items.filter((item) => ['ELEVE', 'ÉLEVÉ', 'ELEVEE', 'ÉLEVÉE'].includes(item.niveauRisque ?? '')).length;

  const columns = useMemo<ResponsiveColumn<Item>[]>(() => [
    { key: 'dossier', header: 'Dossier', render: (item) => <strong>{item.numeroDossier}</strong> },
    { key: 'entreprise', header: 'Entreprise', render: (item) => item.raisonSociale },
    { key: 'programme', header: 'Programme', render: (item) => item.programmeNom ?? '—' },
    { key: 'montant', header: 'Montant demandé', render: (item) => `${Number(item.montantDemande).toLocaleString('fr-FR')} GNF` },
    { key: 'score', header: 'Score', render: (item) => scoreLabel(item.scoreTotal) },
    { key: 'risque', header: 'Risque', render: (item) => <RiskBadge level={item.niveauRisque} /> },
    { key: 'action', header: 'Action', render: (item) => <Button variant="outline" href={`/comite/dossiers/${item.id}`}>Examiner</Button> },
  ], []);

  return <main className={portal.main}>
    <Breadcrumbs items={[
      { label: 'Comité', href: '/comite/dossiers' },
      { label: 'Séance décisionnelle' },
    ]} />
    <p className={portal.eyebrow}>Séance décisionnelle</p>
    <h1 className={portal.title}>Dossiers prêts pour le comité</h1>
    <p className={portal.lead}>Analysez les dossiers complets à partir d’une synthèse lisible : financement demandé, score explicable, niveau de risque et pièces vérifiées avant toute décision humaine.</p>

    <section className={styles.metrics} aria-label="Synthèse de la séance décisionnelle">
      <KpiCard label="Dossiers à statuer" value={String(result.total)} definition="Nombre total de dossiers actuellement prêts à être examinés par le comité." />
      <KpiCard label="Montant demandé" value={amount.toLocaleString('fr-FR')} unit="GNF" definition="Somme des montants demandés par les dossiers affichés sur la page courante." />
      <KpiCard label="Risque faible" value={String(lowRiskCount)} definition="Dossiers de la page courante classés en risque faible par le scoring disponible." />
      <KpiCard label="Risque élevé" value={String(highRiskCount)} definition="Dossiers de la page courante classés en risque élevé et nécessitant une vigilance renforcée." goodDirection="down" />
    </section>

    {message && <div className={`${portal.notice} ${portal.section}`} role="status">{message}</div>}

    <section className={portal.section}>
      <div className={portal.sectionHeader}>
        <div>
          <h2>Ordre du jour</h2>
          <p>Chaque dossier ouvre une vue détaillée avant décision ; aucune décision n’est prise depuis cette liste.</p>
        </div>
      </div>
      <ResponsiveTable
        rows={items}
        columns={columns}
        rowKey={(item) => item.id}
        caption="Dossiers prêts pour la séance décisionnelle"
        emptyMessage="Aucun dossier n’est en attente de décision."
      />
    </section>
    <Pagination page={result.page} limite={result.limite} total={result.total} onChange={load} buttonClassName={portal.secondary} rowClassName={portal.buttonRow} />
  </main>;
}
