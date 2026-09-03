'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import KpiCard, { KpiTrend } from '../../_shared/KpiCard';
import ExecutiveAlert, { ExecutiveAlertData } from '../../_shared/ExecutiveAlert';
import { DownloadIcon, RefreshIcon } from '../../_shared/Icons';
import portal from '../../entrepreneur/portal.module.css';
import styles from '../direction.module.css';

type Choice = { id: string; nom: string };
type Breakdown = { id: string | null; nom: string; dossiers: number; montantDemande: number; montantApprouve?: number };
type BankBreakdown = { id: string | null; nom: string; financements: number; montantDecaisse: number; montantRembourse: number; impayes: number };

type Dashboard = {
  filters: { regions: Choice[]; programmes: Choice[]; secteurs: Choice[]; banques: Choice[] };
  period: { from: string; to: string } | null;
  kpis: {
    pmeEnregistrees: number; dossiersActifs: number; dossiersDeposes: number; dossiersEnInstruction: number;
    dossiersApprouves: number; dossiersRejetes: number; montantDemande: number; montantApprouve: number;
    montantDecaisse: number; montantRembourse: number; encours: number; impayes: number;
    tauxRemboursement: number; tauxDirigeantesFemmes: number | null; tauxDirigeantsJeunes: number | null;
  };
  trends: Record<'montantDemande' | 'montantApprouve' | 'montantDecaisse' | 'montantRembourse', KpiTrend> | null;
  pipeline: { statut: string; total: number; montantDemande: number }[];
  regions: Breakdown[];
  sectors: Breakdown[];
  programs: Breakdown[];
  banks: BankBreakdown[];
  recentApplications: {
    id: string; numeroDossier: string; raisonSociale: string; region: string; programme: string;
    montantDemande: number; statut: string; scoreTotal: number | null; updatedAt: string;
  }[];
  impact: { emploisCrees: number; emploisMaintenus: number; chiffreAffaires: number; entreprisesSuivies: number; tauxDirigeantesFemmes: number | null };
  alerts: ExecutiveAlertData[];
  freshness: { generatedAt: string; sourceUpdatedAt: string | null; source: string };
};

const statusLabels: Record<string, string> = {
  BROUILLON: 'Brouillon', SOUMIS: 'Soumis', EN_INSTRUCTION: 'En instruction',
  COMPLEMENT_REQUIS: 'Complément requis', PRET_COMITE: 'Prêt comité',
  APPROUVE: 'Approuvé', REJETE: 'Rejeté', ANNULE: 'Annulé',
};

function formatAmount(value: number): string {
  if (value >= 1_000_000_000) return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / 1_000_000_000) + ' Md';
  if (value >= 1_000_000) return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / 1_000_000) + ' M';
  return new Intl.NumberFormat('fr-FR').format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value);
}

function formatDate(value: string | null): string {
  if (!value) return 'Aucune donnée source';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export default function DirectionDashboardPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [regionId, setRegionId] = useState('');
  const [programmeId, setProgrammeId] = useState('');
  const [secteurId, setSecteurId] = useState('');
  const [banqueId, setBanqueId] = useState('');
  const [statut, setStatut] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const load = useCallback((signal?: AbortSignal) => {
    const params = new URLSearchParams();
    if (regionId) params.set('regionId', regionId);
    if (programmeId) params.set('programmeId', programmeId);
    if (secteurId) params.set('secteurId', secteurId);
    if (banqueId) params.set('banqueId', banqueId);
    if (statut) params.set('statut', statut);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    setLoading(true);
    setError('');
    return fetch(`/api/direction/dashboard?${params.toString()}`, { cache: 'no-store', signal })
      .then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          router.replace('/direction/connexion');
          throw new Error('Session Direction requise.');
        }
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message ?? 'Impossible de charger le cockpit.');
        return body as Dashboard;
      })
      .then((body) => { setDashboard(body); setLastRefreshedAt(new Date()); })
      .catch((exception) => {
        if (exception instanceof DOMException && exception.name === 'AbortError') return;
        setError(exception instanceof Error ? exception.message : 'Impossible de charger le cockpit.');
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, [banqueId, from, programmeId, regionId, router, secteurId, statut, to]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const hasActiveFilters = Boolean(regionId || programmeId || secteurId || banqueId || statut || from || to);
  function resetFilters() {
    setRegionId(''); setProgrammeId(''); setSecteurId(''); setBanqueId(''); setStatut(''); setFrom(''); setTo('');
  }

  const maxRegionAmount = useMemo(() => Math.max(1, ...(dashboard?.regions.map((r) => r.montantDemande) ?? [1])), [dashboard]);
  const maxSectorCases = useMemo(() => Math.max(1, ...(dashboard?.sectors.map((s) => s.dossiers) ?? [1])), [dashboard]);
  const maxProgramAmount = useMemo(() => Math.max(1, ...(dashboard?.programs.map((p) => p.montantDemande) ?? [1])), [dashboard]);
  const maxBankAmount = useMemo(() => Math.max(1, ...(dashboard?.banks.map((b) => b.montantDecaisse) ?? [1])), [dashboard]);

  function exportCsv() {
    if (!dashboard) return;
    const rows: string[][] = [
      ['Indicateur', 'Valeur', 'Unité'],
      ['PME accompagnées', String(dashboard.kpis.pmeEnregistrees), ''],
      ['Dossiers déposés', String(dashboard.kpis.dossiersDeposes), ''],
      ['Dossiers en instruction', String(dashboard.kpis.dossiersEnInstruction), ''],
      ['Dossiers approuvés', String(dashboard.kpis.dossiersApprouves), ''],
      ['Montant demandé', String(dashboard.kpis.montantDemande), 'GNF'],
      ['Montant accordé', String(dashboard.kpis.montantApprouve), 'GNF'],
      ['Montant décaissé', String(dashboard.kpis.montantDecaisse), 'GNF'],
      ['Montant remboursé', String(dashboard.kpis.montantRembourse), 'GNF'],
      ['Encours', String(dashboard.kpis.encours), 'GNF'],
      ['Impayés', String(dashboard.kpis.impayes), 'GNF'],
      ['Taux de remboursement', String(dashboard.kpis.tauxRemboursement), '%'],
      ['Emplois créés', String(dashboard.impact.emploisCrees), ''],
      ['Emplois maintenus', String(dashboard.impact.emploisMaintenus), ''],
      ['Dirigeantes femmes', dashboard.kpis.tauxDirigeantesFemmes === null ? 'Donnée indisponible' : String(dashboard.kpis.tauxDirigeantesFemmes), '%'],
      ['Dirigeants jeunes', dashboard.kpis.tauxDirigeantsJeunes === null ? 'Donnée indisponible' : String(dashboard.kpis.tauxDirigeantsJeunes), '%'],
    ];
    const csv = rows.map((row) => row.map(csvCell).join(';')).join('\n');
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fodip-cockpit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <main className={portal.main}>
      <div className={styles.cockpitHeader}>
        <div>
          <p className={portal.eyebrow}>Cockpit Direction générale</p>
          <h1 className={portal.title}>Vue d’ensemble du portefeuille FODIP</h1>
          <p className={portal.lead}>
            Vue consolidée du portefeuille FODIP, des financements, des remboursements, des risques et de
            l’impact économique des PME accompagnées.
          </p>
        </div>
        <div className={styles.cockpitHeaderMeta}>
          <span className={styles.sourceBadge}>Source vérifiée</span>
          <span className={styles.freshnessInline}>
            Dernière actualisation&nbsp;: {lastRefreshedAt ? formatDate(lastRefreshedAt.toISOString()) : '—'}
          </span>
          <div className={styles.headerButtons}>
            <button type="button" className={portal.secondary} onClick={() => load()} disabled={loading}>
              <RefreshIcon aria-hidden /> Actualiser
            </button>
            <button type="button" className={portal.secondary} onClick={exportCsv} disabled={!dashboard}>
              <DownloadIcon aria-hidden /> Export Excel (CSV)
            </button>
            <button type="button" className={portal.secondary} onClick={() => window.print()} disabled={!dashboard}>
              Export PDF
            </button>
          </div>
        </div>
      </div>

      <section className={styles.filterBar} aria-label="Filtres du cockpit">
        <div className={styles.filterField}>
          <label htmlFor="from">Période — du</label>
          <input id="from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className={styles.filterField}>
          <label htmlFor="to">au</label>
          <input id="to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <div className={styles.filterField}>
          <label htmlFor="region">Région</label>
          <select id="region" value={regionId} onChange={(event) => setRegionId(event.target.value)}>
            <option value="">Toutes les régions</option>
            {dashboard?.filters.regions.map((item) => <option value={item.id} key={item.id}>{item.nom}</option>)}
          </select>
        </div>
        <div className={styles.filterField}>
          <label htmlFor="programme">Programme</label>
          <select id="programme" value={programmeId} onChange={(event) => setProgrammeId(event.target.value)}>
            <option value="">Tous les programmes</option>
            {dashboard?.filters.programmes.map((item) => <option value={item.id} key={item.id}>{item.nom}</option>)}
          </select>
        </div>
        <div className={styles.filterField}>
          <label htmlFor="secteur">Secteur</label>
          <select id="secteur" value={secteurId} onChange={(event) => setSecteurId(event.target.value)}>
            <option value="">Tous les secteurs</option>
            {dashboard?.filters.secteurs.map((item) => <option value={item.id} key={item.id}>{item.nom}</option>)}
          </select>
        </div>
        <div className={styles.filterField}>
          <label htmlFor="banque">Banque partenaire</label>
          <select id="banque" value={banqueId} onChange={(event) => setBanqueId(event.target.value)}>
            <option value="">Toutes les banques</option>
            {dashboard?.filters.banques.map((item) => <option value={item.id} key={item.id}>{item.nom}</option>)}
          </select>
        </div>
        <div className={styles.filterField}>
          <label htmlFor="statut">Statut du dossier</label>
          <select id="statut" value={statut} onChange={(event) => setStatut(event.target.value)}>
            <option value="">Tous les statuts</option>
            {Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </div>
        {hasActiveFilters && <button className={styles.reset} type="button" onClick={resetFilters}>Réinitialiser</button>}
        <div className={styles.freshness}>
          <strong>Dernière donnée source</strong><br />{formatDate(dashboard?.freshness.sourceUpdatedAt ?? null)}
        </div>
      </section>

      {error && <div className={styles.error} role="alert">{error}</div>}
      {loading && !dashboard && <div className={styles.loading}>Chargement des indicateurs consolidés…</div>}

      {dashboard && (
        <>
          {dashboard.alerts.length > 0 && (
            <section aria-label="Points d’attention" className={styles.alertsSection}>
              <h2 className={styles.sectionTitle}>Points d’attention</h2>
              <ul className={styles.alertsList}>
                {dashboard.alerts.map((alert) => <ExecutiveAlert key={alert.id} alert={alert} />)}
              </ul>
            </section>
          )}

          <section id="indicateurs" className={styles.kpiGrid} aria-label="Indicateurs clés">
            <KpiCard label="PME accompagnées" value={formatNumber(dashboard.kpis.pmeEnregistrees)} definition="Nombre d’entreprises distinctes ayant au moins un dossier dans le périmètre filtré." detailHref="#pipeline" />
            <KpiCard label="Dossiers déposés" value={formatNumber(dashboard.kpis.dossiersDeposes)} definition="Dossiers soumis (hors brouillons), tous statuts confondus." detailHref="#pipeline" />
            <KpiCard label="Dossiers en instruction" value={formatNumber(dashboard.kpis.dossiersEnInstruction)} definition="Dossiers actuellement en instruction ou en attente de complément." detailHref="#pipeline" />
            <KpiCard label="Dossiers approuvés" value={formatNumber(dashboard.kpis.dossiersApprouves)} definition="Dossiers ayant reçu une décision de comité APPROUVE." detailHref="#pipeline" />
            <KpiCard label="Montant demandé" value={formatAmount(dashboard.kpis.montantDemande)} unit="GNF" definition="Somme des montants demandés sur les dossiers déposés (hors brouillons)." trend={dashboard.trends?.montantDemande} detailHref="/direction/financements" />
            <KpiCard label="Montant accordé" value={formatAmount(dashboard.kpis.montantApprouve)} unit="GNF" definition="Somme des montants approuvés par le comité de financement." trend={dashboard.trends?.montantApprouve} detailHref="/direction/financements" />
            <KpiCard label="Montant décaissé" value={formatAmount(dashboard.kpis.montantDecaisse)} unit="GNF" definition="Somme des décaissements effectivement exécutés." trend={dashboard.trends?.montantDecaisse} detailHref="/direction/financements" />
            <KpiCard label="Montant remboursé" value={formatAmount(dashboard.kpis.montantRembourse)} unit="GNF" definition="Somme des remboursements enregistrés à ce jour." trend={dashboard.trends?.montantRembourse} detailHref="/direction/financements" />
            <KpiCard label="Encours" value={formatAmount(dashboard.kpis.encours)} unit="GNF" definition="Montant décaissé restant dû (décaissé moins remboursé)." detailHref="/direction/financements" />
            <KpiCard label="Impayés" value={formatAmount(dashboard.kpis.impayes)} unit="GNF" definition="Montant dû sur des échéances déjà passées et non intégralement remboursées." detailHref="/direction/financements" goodDirection="down" />
            <KpiCard label="Taux de remboursement" value={dashboard.kpis.tauxRemboursement.toLocaleString('fr-FR')} unit="%" definition="Montant remboursé rapporté au montant dû sur échéances passées." detailHref="/direction/financements" />
            <KpiCard label="Emplois créés" value={formatNumber(dashboard.impact.emploisCrees)} definition="Emplois créés déclarés dans le dernier suivi d’impact par PME." detailHref="#impact" />
            <KpiCard label="Emplois maintenus" value={formatNumber(dashboard.impact.emploisMaintenus)} definition="Emplois maintenus déclarés dans le dernier suivi d’impact par PME." detailHref="#impact" />
            <KpiCard label="Dirigeantes femmes" value={dashboard.kpis.tauxDirigeantesFemmes === null ? null : dashboard.kpis.tauxDirigeantesFemmes.toLocaleString('fr-FR')} unit="%" definition="Part des PME du périmètre dont le genre du dirigeant principal renseigné est féminin. Non disponible si aucun dirigeant du périmètre n'a de genre renseigné." detailHref="#impact" />
            <KpiCard label="Dirigeants jeunes" value={dashboard.kpis.tauxDirigeantsJeunes === null ? null : dashboard.kpis.tauxDirigeantsJeunes.toLocaleString('fr-FR')} unit="%" definition="Part des PME du périmètre dont le dirigeant principal avait moins de 35 ans au dépôt du dossier. Non disponible si aucune date de naissance n'est renseignée." detailHref="#impact" />
          </section>

          <section className="dashboard-grid">
            <article className="panel region-panel" id="regions">
              <div className="panel-heading"><div><p className="eyebrow">Répartition territoriale</p><h3>Demandes par région</h3></div></div>
              <div className="region-list">
                {dashboard.regions.length === 0
                  ? <p className={styles.filterSummary}>Aucune région pour ce périmètre.</p>
                  : dashboard.regions.map((region) => (
                    <div className="region-row" key={region.id ?? region.nom}>
                      <span>{region.nom}</span>
                      <div className="bar-track" aria-hidden="true"><div className="bar-value" style={{ width: `${Math.round((region.montantDemande / maxRegionAmount) * 100)}%` }} /></div>
                      <strong>{formatAmount(region.montantDemande)}</strong>
                    </div>
                  ))}
              </div>
            </article>
            <article id="pipeline" className="panel pipeline-panel">
              <div className="panel-heading"><div><p className="eyebrow">Instruction</p><h3>Pipeline des dossiers</h3></div></div>
              <div className="pipeline-total"><strong>{formatNumber(dashboard.kpis.dossiersActifs)}</strong><span>dossiers actifs</span></div>
              <div className="pipeline-list">
                {dashboard.pipeline.map((item) => (
                  <div className="pipeline-row" key={item.statut}><span>{statusLabels[item.statut] ?? item.statut}</span><strong>{item.total}</strong></div>
                ))}
              </div>
            </article>
          </section>

          <section className="dashboard-grid">
            <article className="panel" id="programmes">
              <div className="panel-heading"><div><p className="eyebrow">Performance</p><h3>Dossiers par programme</h3></div></div>
              <div className={styles.sectorList}>
                {dashboard.programs.map((program) => (
                  <div className={styles.sectorRow} key={program.id ?? program.nom}>
                    <span>{program.nom}</span>
                    <div className="bar-track" aria-hidden="true"><div className="bar-value" style={{ width: `${Math.round((program.montantDemande / maxProgramAmount) * 100)}%` }} /></div>
                    <strong>{program.dossiers}</strong>
                  </div>
                ))}
              </div>
            </article>
            <article className="panel">
              <div className="panel-heading"><div><p className="eyebrow">Portefeuille</p><h3>Dossiers par secteur</h3></div></div>
              <div className={styles.sectorList}>
                {dashboard.sectors.map((sector) => (
                  <div className={styles.sectorRow} key={sector.id ?? sector.nom}>
                    <span>{sector.nom}</span>
                    <div className="bar-track" aria-hidden="true"><div className="bar-value" style={{ width: `${Math.round((sector.dossiers / maxSectorCases) * 100)}%` }} /></div>
                    <strong>{sector.dossiers}</strong>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="dashboard-grid">
            <article className="panel" id="banques">
              <div className="panel-heading"><div><p className="eyebrow">Partenaires</p><h3>Performance des banques partenaires</h3></div></div>
              <div className={styles.sectorList}>
                {dashboard.banks.length === 0
                  ? <p className={styles.filterSummary}>Aucun financement rattaché à une banque partenaire pour ce périmètre.</p>
                  : dashboard.banks.map((bank) => (
                    <div className={styles.sectorRow} key={bank.id ?? bank.nom}>
                      <span>{bank.nom}</span>
                      <div className="bar-track" aria-hidden="true"><div className="bar-value" style={{ width: `${Math.round((bank.montantDecaisse / maxBankAmount) * 100)}%` }} /></div>
                      <strong>{formatAmount(bank.montantDecaisse)}</strong>
                    </div>
                  ))}
              </div>
            </article>
            <article id="impact" className="panel impact-panel">
              <div className="panel-heading"><div><p className="eyebrow">Impact mesuré</p><h3>Derniers suivis</h3></div></div>
              <div className={styles.secondaryMetric}><span>PME suivies</span><strong>{formatNumber(dashboard.impact.entreprisesSuivies)}</strong></div>
              <div className={styles.secondaryMetric}><span>CA observé</span><strong>{formatAmount(dashboard.impact.chiffreAffaires)} GNF</strong></div>
            </article>
          </section>

          <section className="dashboard-grid lower-grid">
            <article className="panel table-panel">
              <div className="panel-heading"><div><p className="eyebrow">Activité récente</p><h3>Derniers dossiers mis à jour</h3></div></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Dossier</th><th>Entreprise</th><th>Région</th><th>Statut</th><th>Score</th><th>Montant</th></tr></thead>
                  <tbody>
                    {dashboard.recentApplications.map((item) => (
                      <tr key={item.id}>
                        <td><strong>{item.numeroDossier}</strong></td>
                        <td>{item.raisonSociale}</td>
                        <td>{item.region}</td>
                        <td><span className="status-pill">{statusLabels[item.statut] ?? item.statut}</span></td>
                        <td>{item.scoreTotal ?? '—'}</td>
                        <td>{formatAmount(item.montantDemande)} GNF</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
            <article className="panel impact-panel">
              <div className="panel-heading"><div><p className="eyebrow">Qualité</p><h3>Traçabilité</h3></div></div>
              <p className={styles.filterSummary}>Grain portefeuille : un dossier. Grain impact : dernier suivi par PME. Grain financement : un financement.</p>
              <div className={styles.secondaryMetric}><span>Calcul généré</span><strong>{formatDate(dashboard.freshness.generatedAt)}</strong></div>
              <div className={styles.secondaryMetric}><span>Source</span><strong>{dashboard.freshness.source}</strong></div>
              <Link href="/direction/financements" className={portal.secondary} style={{ marginTop: 12, display: 'inline-flex' }}>Gérer les financements</Link>
            </article>
          </section>
        </>
      )}
    </main>
  );
}
