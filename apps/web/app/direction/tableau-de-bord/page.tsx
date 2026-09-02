'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import ThemeToggle from '../../_shared/ThemeToggle';
import { DirectionAccountMenu } from '../components/DirectionAccountMenu';
import styles from '../direction.module.css';

type Choice = { id: string; nom: string };
type Dashboard = {
  filters: { regions: Choice[]; programmes: Choice[] };
  kpis: {
    pmeEnregistrees: number; dossiersActifs: number; montantDemande: number;
    montantApprouve: number; montantDecaisse: number; emploisCrees: number;
    tauxRemboursement: number; impayes: number;
  };
  pipeline: { statut: string; total: number; montantDemande: number }[];
  regions: { id: string | null; nom: string; dossiers: number; montantDemande: number; montantApprouve: number }[];
  sectors: { id: string | null; nom: string; dossiers: number; montantDemande: number }[];
  recentApplications: {
    id: string; numeroDossier: string; raisonSociale: string; region: string; programme: string;
    montantDemande: number; statut: string; scoreTotal: number | null; updatedAt: string;
  }[];
  impact: {
    emploisCrees: number; emploisMaintenus: number; chiffreAffaires: number;
    entreprisesSuivies: number; tauxDirigeantesFemmes: number;
  };
  freshness: { generatedAt: string; sourceUpdatedAt: string | null; source: string };
};

// Was a row of plain <span> elements up to this point - styled like links (.nav-item in
// globals.css already had text-decoration/focus-visible rules for one) but with no href and no
// click handler, so nothing past "Vue nationale" ever did anything. Each item now points
// somewhere real: the two dedicated Direction routes, or an anchor into a section already
// rendered further down this same page (no fabricated destination for a page that doesn't
// exist yet - "Décaissements"/"Impact" are genuinely managed per financement on
// /direction/financements, and this dashboard already has an aggregate "PME"/"Dossiers"/
// "Impact" section to land on for the other three).
const navItems: { label: string; href: string }[] = [
  { label: 'Vue nationale', href: '/direction/tableau-de-bord' },
  { label: 'PME', href: '/direction/tableau-de-bord#indicateurs' },
  { label: 'Dossiers', href: '/direction/tableau-de-bord#pipeline' },
  { label: 'Financements', href: '/direction/financements' },
  { label: 'Décaissements', href: '/direction/financements' },
  { label: 'Impact', href: '/direction/tableau-de-bord#impact' },
];
const statusLabels: Record<string, string> = {
  BROUILLON: 'Brouillon', SOUMIS: 'Soumis', EN_INSTRUCTION: 'En instruction',
  COMPLEMENT_REQUIS: 'Complément requis', PRET_COMITE: 'Prêt comité',
  APPROUVE: 'Approuvé', REJETE: 'Rejeté', ANNULE: 'Annulé',
};

function formatAmount(value: number): string {
  if (value >= 1_000_000_000) return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / 1_000_000_000)} Md`;
  if (value >= 1_000_000) return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / 1_000_000)} M`;
  return new Intl.NumberFormat('fr-FR').format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value);
}

function formatDate(value: string | null): string {
  if (!value) return 'Aucune donnée source';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function DirectionDashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [regionId, setRegionId] = useState('');
  const [programmeId, setProgrammeId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (regionId) params.set('regionId', regionId);
    if (programmeId) params.set('programmeId', programmeId);
    setLoading(true);
    setError('');
    fetch(`/api/direction/dashboard?${params.toString()}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          router.replace('/direction/connexion');
          throw new Error('Session Direction requise.');
        }
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message ?? 'Impossible de charger le cockpit.');
        return body as Dashboard;
      })
      .then(setDashboard)
      .catch((exception) => {
        if (exception instanceof DOMException && exception.name === 'AbortError') return;
        setError(exception instanceof Error ? exception.message : 'Impossible de charger le cockpit.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [programmeId, regionId, router]);

  const maxRegionAmount = useMemo(
    () => Math.max(1, ...(dashboard?.regions.map((region) => region.montantDemande) ?? [1])),
    [dashboard],
  );
  const maxSectorCases = useMemo(
    () => Math.max(1, ...(dashboard?.sectors.map((sector) => sector.dossiers) ?? [1])),
    [dashboard],
  );

  return <main className="app-shell">
    <a href="#main-content" className="skip-link">Aller au contenu principal</a>
    <aside className="sidebar" aria-label="Navigation principale">
      <div className="brand"><div className="brand-mark" aria-hidden="true">FD</div><div><strong>FODIP</strong><span>Digital 2030</span></div></div>
      <nav className="nav-list">
        {navItems.map((item) => {
          // Only a plain page link (no #anchor) can meaningfully be "the current page" - an
          // in-page anchor doesn't represent a distinct route to highlight against.
          const isActive = !item.href.includes('#') && pathname === item.href;
          return (
            <Link className={isActive ? 'nav-item active' : 'nav-item'} href={item.href} key={item.label}>
              <span className="nav-dot" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-footer"><span className="environment">DIRECTION GÉNÉRALE</span><strong>Portail décisionnel</strong><small>Données consolidées PostgreSQL</small></div>
    </aside>

    <section id="main-content" tabIndex={-1} className="content">
      <header className="topbar">
        <div><p className="eyebrow">Cockpit national</p><h1>Vue d’ensemble</h1></div>
        <div className="topbar-actions"><Link className="secondary-button" href="/notifications">Notifications</Link><Link className="secondary-button" href="/mes-donnees">Mes données</Link><Link className="secondary-button" href="/direction/financements">Gérer les financements</Link><span className={styles.sourceBadge}>Source vérifiée</span><ThemeToggle buttonClassName="theme-toggle" /><DirectionAccountMenu /></div>
      </header>

      {dashboard && <section className={styles.filterBar} aria-label="Filtres du cockpit">
        <div className={styles.filterField}><label htmlFor="region">Région</label><select id="region" value={regionId} onChange={(event) => setRegionId(event.target.value)}><option value="">Toutes les régions</option>{dashboard.filters.regions.map((item) => <option value={item.id} key={item.id}>{item.nom}</option>)}</select></div>
        <div className={styles.filterField}><label htmlFor="programme">Programme</label><select id="programme" value={programmeId} onChange={(event) => setProgrammeId(event.target.value)}><option value="">Tous les programmes</option>{dashboard.filters.programmes.map((item) => <option value={item.id} key={item.id}>{item.nom}</option>)}</select></div>
        {(regionId || programmeId) && <button className={styles.reset} type="button" onClick={() => { setRegionId(''); setProgrammeId(''); }}>Réinitialiser</button>}
        <div className={styles.freshness}><strong>Dernière donnée source</strong><br />{formatDate(dashboard.freshness.sourceUpdatedAt)}</div>
      </section>}

      {error && <div className={styles.error} role="alert">{error}</div>}
      {loading && !dashboard && <div className={styles.loading}>Chargement des indicateurs consolidés…</div>}

      {dashboard && <>
        <section className="hero-panel">
          <div><span className="hero-kicker">FODIP DIGITAL 2030</span><h2>Piloter l’impact économique des PME guinéennes.</h2><p>Les indicateurs sont calculés depuis les vues analytiques PostgreSQL du socle Docker, selon les filtres actifs.</p></div>
          <div className="hero-summary"><span>Montant approuvé</span><strong>{formatAmount(dashboard.kpis.montantApprouve)} GNF</strong><small>{formatAmount(dashboard.kpis.montantDecaisse)} GNF effectivement décaissés</small></div>
        </section>

        <section id="indicateurs" className="stats-grid" aria-label="Indicateurs clés">
          <article className="stat-card"><span>PME dans le portefeuille</span><div className="stat-value-row"><strong>{formatNumber(dashboard.kpis.pmeEnregistrees)}</strong></div><em className="neutral">Au moins un dossier dans le périmètre</em></article>
          <article className="stat-card"><span>Dossiers actifs</span><div className="stat-value-row"><strong>{formatNumber(dashboard.kpis.dossiersActifs)}</strong></div><em className="neutral">Soumis à prêt pour comité</em></article>
          <article className="stat-card"><span>Montants demandés</span><div className="stat-value-row"><strong>{formatAmount(dashboard.kpis.montantDemande)}</strong><small>GNF</small></div><em className="neutral">Hors brouillons</em></article>
          <article className="stat-card"><span>Montants décaissés</span><div className="stat-value-row"><strong>{formatAmount(dashboard.kpis.montantDecaisse)}</strong><small>GNF</small></div><em className="positive">Décaissements effectués</em></article>
          <article className="stat-card"><span>Emplois créés</span><div className="stat-value-row"><strong>{formatNumber(dashboard.kpis.emploisCrees)}</strong></div><em className="positive">Dernier suivi par PME</em></article>
          <article className="stat-card"><span>Taux de remboursement</span><div className="stat-value-row"><strong>{dashboard.kpis.tauxRemboursement.toLocaleString('fr-FR')} %</strong></div><em className={dashboard.kpis.impayes > 0 ? 'neutral' : 'positive'}>{formatAmount(dashboard.kpis.impayes)} GNF d’impayés</em></article>
        </section>

        <section className="dashboard-grid">
          <article className="panel region-panel"><div className="panel-heading"><div><p className="eyebrow">Répartition territoriale</p><h3>Demandes par région</h3></div></div><div className="region-list">{dashboard.regions.length === 0 ? <p className={styles.filterSummary}>Aucune région pour ce périmètre.</p> : dashboard.regions.map((region) => <div className="region-row" key={region.id ?? region.nom}><span>{region.nom}</span><div className="bar-track" aria-hidden="true"><div className="bar-value" style={{ width: `${Math.round((region.montantDemande / maxRegionAmount) * 100)}%` }} /></div><strong>{formatAmount(region.montantDemande)}</strong></div>)}</div></article>
          <article id="pipeline" className="panel pipeline-panel"><div className="panel-heading"><div><p className="eyebrow">Instruction</p><h3>Pipeline des dossiers</h3></div></div><div className="pipeline-total"><strong>{formatNumber(dashboard.kpis.dossiersActifs)}</strong><span>dossiers actifs</span></div><div className="pipeline-list">{dashboard.pipeline.map((item) => <div className="pipeline-row" key={item.statut}><span>{statusLabels[item.statut] ?? item.statut}</span><strong>{item.total}</strong></div>)}</div></article>
        </section>

        <section className="dashboard-grid">
          <article className="panel"><div className="panel-heading"><div><p className="eyebrow">Portefeuille</p><h3>Dossiers par secteur</h3></div></div><div className={styles.sectorList}>{dashboard.sectors.map((sector) => <div className={styles.sectorRow} key={sector.id ?? sector.nom}><span>{sector.nom}</span><div className="bar-track" aria-hidden="true"><div className="bar-value" style={{ width: `${Math.round((sector.dossiers / maxSectorCases) * 100)}%` }} /></div><strong>{sector.dossiers}</strong></div>)}</div></article>
          <article id="impact" className="panel impact-panel"><div className="panel-heading"><div><p className="eyebrow">Impact mesuré</p><h3>Derniers suivis</h3></div></div><div className={styles.secondaryMetric}><span>Emplois maintenus</span><strong>{formatNumber(dashboard.impact.emploisMaintenus)}</strong></div><div className={styles.secondaryMetric}><span>PME suivies</span><strong>{formatNumber(dashboard.impact.entreprisesSuivies)}</strong></div><div className={styles.secondaryMetric}><span>Dirigeantes femmes</span><strong>{dashboard.impact.tauxDirigeantesFemmes.toLocaleString('fr-FR')} %</strong></div><div className={styles.secondaryMetric}><span>CA observé</span><strong>{formatAmount(dashboard.impact.chiffreAffaires)} GNF</strong></div></article>
        </section>

        <section className="dashboard-grid lower-grid">
          <article className="panel table-panel"><div className="panel-heading"><div><p className="eyebrow">Activité récente</p><h3>Derniers dossiers mis à jour</h3></div></div><div className="table-wrap"><table><thead><tr><th>Dossier</th><th>Entreprise</th><th>Région</th><th>Statut</th><th>Score</th><th>Montant</th></tr></thead><tbody>{dashboard.recentApplications.map((item) => <tr key={item.id}><td><strong>{item.numeroDossier}</strong></td><td>{item.raisonSociale}</td><td>{item.region}</td><td><span className="status-pill">{statusLabels[item.statut] ?? item.statut}</span></td><td>{item.scoreTotal ?? '—'}</td><td>{formatAmount(item.montantDemande)} GNF</td></tr>)}</tbody></table></div></article>
          <article className="panel impact-panel"><div className="panel-heading"><div><p className="eyebrow">Qualité</p><h3>Traçabilité</h3></div></div><p className={styles.filterSummary}>Grain portefeuille : un dossier. Grain impact : dernier suivi par PME. Grain financement : un financement.</p><div className={styles.secondaryMetric}><span>Calcul généré</span><strong>{formatDate(dashboard.freshness.generatedAt)}</strong></div><div className={styles.secondaryMetric}><span>Source</span><strong>{dashboard.freshness.source}</strong></div></article>
        </section>
      </>}
    </section>
  </main>;
}
