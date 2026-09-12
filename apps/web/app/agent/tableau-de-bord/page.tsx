'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Breadcrumbs from '../../_shared/Breadcrumbs';
import KpiCard from '../../_shared/KpiCard';
import role from '../../_shared/RoleDashboard.module.css';
import portal from '../../entrepreneur/portal.module.css';

type Summary = {
  aPrendre: number;
  mesDossiers: number;
  complements: number;
  pretComite: number;
  historique: number;
};

const EMPTY_SUMMARY: Summary = {
  aPrendre: 0,
  mesDossiers: 0,
  complements: 0,
  pretComite: 0,
  historique: 0,
};

export default function AgentDashboardPage() {
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/agent/dossiers/summary', { cache: 'no-store' })
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
    <Breadcrumbs items={[{ label: 'Agent', href: '/agent/tableau-de-bord' }, { label: 'Tableau de bord' }]} />

    <div className={role.pageHeader}>
      <div>
        <p className={portal.eyebrow}>Poste d’instruction</p>
        <h1 className={portal.title}>Tableau de bord Agent</h1>
        <p className={portal.lead}>Votre charge de travail réelle, les dossiers à reprendre et les transmissions au comité, sans données de démonstration.</p>
      </div>
    </div>

    {message ? <div className={portal.notice} role="status">{message}</div> : null}

    <section className={role.kpiGrid} aria-label="Synthèse personnelle de l’agent">
      <KpiCard label="À prendre" value={String(summary.aPrendre)} definition="Dossiers soumis, non affectés, disponibles pour prise en charge." />
      <KpiCard label="Mes dossiers" value={String(summary.mesDossiers)} definition="Dossiers actuellement affectés à votre compte et encore en instruction." />
      <KpiCard label="Compléments" value={String(summary.complements)} definition="Vos dossiers en attente d’un complément de la PME." />
      <KpiCard label="Prêts comité" value={String(summary.pretComite)} definition="Dossiers que vous avez instruits et transmis au comité." />
    </section>

    <section className={`${role.sectionGrid} ${portal.section}`} aria-label="Accès rapides au portefeuille Agent">
      <article className={role.contextCard}>
        <h2>File de travail</h2>
        <p>Choisissez la vue qui correspond à l’action que vous devez réaliser. Les vues personnelles sont filtrées côté serveur avec votre identité de session.</p>
        <div className={portal.buttonRow}>
          <Link className={portal.primary} href="/agent/dossiers?vue=A_PRENDRE">Dossiers à prendre</Link>
          <Link className={portal.secondary} href="/agent/dossiers?vue=MES_DOSSIERS">Mes dossiers</Link>
          <Link className={portal.secondary} href="/agent/dossiers?vue=COMPLEMENTS">Compléments</Link>
          <Link className={portal.secondary} href="/agent/dossiers?vue=PRET_COMITE">Prêts comité</Link>
        </div>
      </article>

      <aside className={role.contextCard}>
        <h2>Historique</h2>
        <p>Retrouvez les dossiers sur lesquels votre compte Agent a déjà effectué une transition métier.</p>
        <p><strong>{summary.historique.toLocaleString('fr-FR')}</strong> dossier{summary.historique > 1 ? 's' : ''} dans votre historique.</p>
        <div className={portal.buttonRow}>
          <Link className={portal.secondary} href="/agent/dossiers?vue=HISTORIQUE">Voir l’historique</Link>
        </div>
      </aside>
    </section>
  </main>;
}
