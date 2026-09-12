'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Breadcrumbs from '../../_shared/Breadcrumbs';
import KpiCard from '../../_shared/KpiCard';
import role from '../../_shared/RoleDashboard.module.css';
import portal from '../../entrepreneur/portal.module.css';

type Summary = {
  aStatuer: number;
  montantDemande: number | string;
  risqueEleve: number;
  ancienneteMaxJours: number;
  decisionsTotal: number;
  decisionsAujourdhui: number;
  approuves: number;
  rejetes: number;
  complements: number;
};

const EMPTY_SUMMARY: Summary = {
  aStatuer: 0, montantDemande: 0, risqueEleve: 0, ancienneteMaxJours: 0,
  decisionsTotal: 0, decisionsAujourdhui: 0, approuves: 0, rejetes: 0, complements: 0,
};

export default function CommitteeDashboardPage() {
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/comite/dossiers/summary', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.message ?? 'Chargement du tableau de bord impossible');
        if (active) setSummary(body);
      })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : 'Chargement impossible'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <main className={portal.main} aria-busy={loading}>
    <Breadcrumbs items={[{ label: 'Comité', href: '/comite/tableau-de-bord' }, { label: 'Tableau de bord' }]} />
    <div className={role.pageHeader}>
      <div>
        <p className={portal.eyebrow}>Pilotage de séance</p>
        <h1 className={portal.title}>Tableau de bord Comité</h1>
        <p className={portal.lead}>Préparez l’ordre du jour, identifiez les dossiers prioritaires et retrouvez les décisions réellement enregistrées.</p>
      </div>
    </div>

    {message ? <div className={portal.notice} role="status">{message}</div> : null}

    <section className={role.kpiGrid} aria-label="Synthèse de la séance du comité">
      <KpiCard label="À statuer" value={String(summary.aStatuer)} definition="Dossiers prêts à recevoir une décision du comité." />
      <KpiCard label="Montant demandé" value={Number(summary.montantDemande).toLocaleString('fr-FR')} unit="GNF" definition="Montant cumulé des dossiers actuellement à l’ordre du jour." />
      <KpiCard label="Risque élevé" value={String(summary.risqueEleve)} definition="Dossiers à l’ordre du jour classés en risque élevé par le scoring." goodDirection="down" />
      <KpiCard label="Attente maximale" value={String(summary.ancienneteMaxJours)} unit="jours" definition="Ancienneté du dossier présent depuis le plus longtemps dans la file du comité." goodDirection="down" />
    </section>

    <section className={`${role.sectionGrid} ${portal.section}`} aria-label="Accès rapides du comité">
      <article className={role.contextCard}>
        <h2>Ordre du jour</h2>
        <p>{summary.aStatuer} dossier{summary.aStatuer > 1 ? 's' : ''} à examiner, dont {summary.risqueEleve} à vigilance renforcée. La décision reste humaine, motivée et auditée.</p>
        <div className={portal.buttonRow}>
          <Link className={portal.primary} href="/comite/dossiers?vue=ORDRE_DU_JOUR">Préparer la séance</Link>
        </div>
      </article>
      <aside className={role.contextCard}>
        <h2>Décisions enregistrées</h2>
        <p><strong>{summary.decisionsTotal.toLocaleString('fr-FR')}</strong> décision{summary.decisionsTotal > 1 ? 's' : ''}, dont {summary.decisionsAujourdhui} aujourd’hui.</p>
        <p>{summary.approuves} approuvée{summary.approuves > 1 ? 's' : ''} · {summary.rejetes} rejetée{summary.rejetes > 1 ? 's' : ''} · {summary.complements} complément{summary.complements > 1 ? 's' : ''}</p>
        <div className={portal.buttonRow}>
          <Link className={portal.secondary} href="/comite/dossiers?vue=HISTORIQUE">Consulter l’historique</Link>
        </div>
      </aside>
    </section>
  </main>;
}
