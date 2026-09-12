'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Breadcrumbs from '../../_shared/Breadcrumbs';
import Button from '../../_shared/Button';
import FilterBar, { FilterField } from '../../_shared/FilterBar';
import Pagination from '../../_shared/Pagination';
import ResponsiveTable, { type ResponsiveColumn } from '../../_shared/ResponsiveTable';
import { DossierStatusBadge, RiskBadge } from '../../_shared/StatusBadge';
import role from '../../_shared/RoleDashboard.module.css';
import portal from '../../entrepreneur/portal.module.css';

type ViewMode = 'ORDRE_DU_JOUR' | 'HISTORIQUE';
type SortMode = 'anciennete' | 'montant' | 'score';
type Item = {
  id: string; numeroDossier: string; raisonSociale: string; programmeNom?: string;
  montantDemande: number | string; scoreTotal?: number | string; niveauRisque?: string;
  recommandation?: string; statut: string; dateSoumission?: string;
  decision?: string; montantApprouve?: number | string; dateDecision?: string;
};
type Result = { items: Item[]; total: number; page: number; limite: number };

const VIEW_COPY: Record<ViewMode, { title: string; description: string }> = {
  ORDRE_DU_JOUR: {
    title: 'Ordre du jour du comité',
    description: 'Dossiers prêts à statuer, classés par ancienneté ou niveau d’exposition selon les besoins de la séance.',
  },
  HISTORIQUE: {
    title: 'Historique des décisions',
    description: 'Décisions réellement enregistrées par le comité, de la plus récente à la plus ancienne.',
  },
};

function viewFromLocation(): ViewMode {
  if (typeof window === 'undefined') return 'ORDRE_DU_JOUR';
  return new URLSearchParams(window.location.search).get('vue') === 'HISTORIQUE' ? 'HISTORIQUE' : 'ORDRE_DU_JOUR';
}

function scoreLabel(value?: number | string) {
  return value === undefined || value === null || value === '' ? '—' : `${value}/100`;
}

function decisionLabel(value?: string) {
  if (value === 'APPROUVE') return 'Approuvé';
  if (value === 'REJETE') return 'Rejeté';
  if (value === 'COMPLEMENT_REQUIS') return 'Complément requis';
  return '—';
}

export default function CommitteeApplicationsPage() {
  const [result, setResult] = useState<Result>({ items: [], total: 0, page: 1, limite: 25 });
  const [vue, setVue] = useState<ViewMode>('ORDRE_DU_JOUR');
  const [recherche, setRecherche] = useState('');
  const [risque, setRisque] = useState('');
  const [decision, setDecision] = useState('');
  const [tri, setTri] = useState<SortMode>('anciennete');
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async (page = 1, filters?: { vue: ViewMode; recherche: string; risque: string; decision: string; tri: SortMode }) => {
    const active = filters ?? { vue, recherche, risque, decision, tri };
    setLoading(true);
    setMessage('');
    const query = new URLSearchParams({ page: String(page), vue: active.vue, tri: active.tri });
    if (active.recherche.trim()) query.set('recherche', active.recherche.trim());
    if (active.risque) query.set('risque', active.risque);
    if (active.vue === 'HISTORIQUE' && active.decision) query.set('decision', active.decision);
    try {
      const response = await fetch(`/api/comite/dossiers?${query}`, { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message ?? 'Chargement impossible');
      setResult(body);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [decision, recherche, risque, tri, vue]);

  useEffect(() => {
    setVue(viewFromLocation());
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!initialized) return;
    const filters = { vue, recherche: '', risque: '', decision: '', tri };
    setRecherche(''); setRisque(''); setDecision('');
    window.history.replaceState(null, '', `/comite/dossiers?vue=${vue}`);
    void load(1, filters);
  // Filters intentionally reset only when the working view changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, vue]);

  function filter(event: FormEvent) {
    event.preventDefault();
    void load(1);
  }

  function resetFilters() {
    setRecherche(''); setRisque(''); setDecision(''); setTri('anciennete');
    void load(1, { vue, recherche: '', risque: '', decision: '', tri: 'anciennete' });
  }

  const columns = useMemo<ResponsiveColumn<Item>[]>(() => {
    const common: ResponsiveColumn<Item>[] = [
      { key: 'dossier', header: 'Dossier', render: (item) => <strong>{item.numeroDossier}</strong> },
      { key: 'entreprise', header: 'Entreprise', render: (item) => item.raisonSociale },
      { key: 'programme', header: 'Programme', render: (item) => item.programmeNom ?? '—' },
      { key: 'montant', header: 'Montant demandé', render: (item) => `${Number(item.montantDemande).toLocaleString('fr-FR')} GNF` },
      { key: 'score', header: 'Score', render: (item) => scoreLabel(item.scoreTotal) },
      { key: 'risque', header: 'Risque', render: (item) => <RiskBadge level={item.niveauRisque} /> },
    ];
    if (vue === 'HISTORIQUE') common.push(
      { key: 'decision', header: 'Décision', render: (item) => <DossierStatusBadge status={item.decision ?? item.statut} /> },
      { key: 'date', header: 'Décidé le', render: (item) => item.dateDecision ? new Date(item.dateDecision).toLocaleDateString('fr-FR') : '—' },
    );
    common.push({ key: 'action', header: 'Action', render: (item) => <Button variant="outline" href={`/comite/dossiers/${item.id}`}>{vue === 'HISTORIQUE' ? 'Consulter' : 'Examiner'}</Button> });
    return common;
  }, [vue]);

  const copy = VIEW_COPY[vue];
  const activeFilterCount = Number(Boolean(recherche.trim())) + Number(Boolean(risque)) + Number(Boolean(decision)) + Number(tri !== 'anciennete');
  const nextDossier = result.items[0];

  return <main className={portal.main} aria-busy={loading}>
    <Breadcrumbs items={[{ label: 'Comité', href: '/comite/tableau-de-bord' }, { label: vue === 'HISTORIQUE' ? 'Historique' : 'Ordre du jour' }]} />
    <div className={role.pageHeader}>
      <div>
        <p className={portal.eyebrow}>Séance décisionnelle</p>
        <h1 className={portal.title}>{copy.title}</h1>
        <p className={portal.lead}>{copy.description}</p>
      </div>
    </div>

    <section className={role.priorityCard} aria-labelledby="committee-priority-title">
      <div className={role.priorityMain}>
        <p className={role.priorityLabel}>{vue === 'HISTORIQUE' ? 'Traçabilité' : 'File décisionnelle'}</p>
        <h2 className={role.priorityTitle} id="committee-priority-title">{result.total} dossier{result.total > 1 ? 's' : ''}</h2>
        <p className={role.priorityDescription}>{copy.description} Les données et filtres sont appliqués côté serveur.</p>
      </div>
      <aside className={role.priorityAside}>
        <div className={role.nextAction}><span>{vue === 'HISTORIQUE' ? 'Dernière décision' : 'Prochain dossier'}</span><strong>{nextDossier ? `${nextDossier.numeroDossier} · ${vue === 'HISTORIQUE' ? decisionLabel(nextDossier.decision) : nextDossier.raisonSociale}` : 'Aucun dossier dans cette vue.'}</strong></div>
        {nextDossier ? <Button href={`/comite/dossiers/${nextDossier.id}`}>{vue === 'HISTORIQUE' ? 'Consulter' : 'Examiner maintenant'}</Button> : null}
      </aside>
    </section>

    <form className={portal.section} onSubmit={filter}>
      <FilterBar activeCount={activeFilterCount} onReset={resetFilters} actions={<Button type="submit">Filtrer</Button>} ariaLabel="Filtres des dossiers du comité">
        <FilterField label="Vue" htmlFor="vue-comite">
          <select id="vue-comite" value={vue} onChange={(event) => setVue(event.target.value as ViewMode)}>
            <option value="ORDRE_DU_JOUR">Ordre du jour</option>
            <option value="HISTORIQUE">Historique</option>
          </select>
        </FilterField>
        <FilterField label="Recherche" htmlFor="recherche-comite">
          <input id="recherche-comite" type="search" value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder="N° dossier ou PME" />
        </FilterField>
        <FilterField label="Risque" htmlFor="risque-comite">
          <select id="risque-comite" value={risque} onChange={(event) => setRisque(event.target.value)}>
            <option value="">Tous les risques</option><option value="FAIBLE">Faible</option><option value="MODERE">Modéré</option><option value="ELEVE">Élevé</option>
          </select>
        </FilterField>
        {vue === 'HISTORIQUE' ? <FilterField label="Décision" htmlFor="decision-comite">
          <select id="decision-comite" value={decision} onChange={(event) => setDecision(event.target.value)}>
            <option value="">Toutes les décisions</option><option value="APPROUVE">Approuvé</option><option value="REJETE">Rejeté</option><option value="COMPLEMENT_REQUIS">Complément requis</option>
          </select>
        </FilterField> : <FilterField label="Priorité" htmlFor="tri-comite">
          <select id="tri-comite" value={tri} onChange={(event) => setTri(event.target.value as SortMode)}>
            <option value="anciennete">Plus anciens d’abord</option><option value="score">Score décroissant</option><option value="montant">Montant décroissant</option>
          </select>
        </FilterField>}
      </FilterBar>
    </form>

    {message ? <div className={`${portal.notice} ${portal.section}`} role="status">{message}</div> : null}
    <section className={portal.section}>
      <ResponsiveTable rows={result.items} columns={columns} rowKey={(item) => item.id} caption={vue === 'HISTORIQUE' ? 'Historique des décisions du comité' : 'Ordre du jour du comité'} emptyMessage={loading ? 'Chargement…' : vue === 'HISTORIQUE' ? 'Aucune décision ne correspond aux critères.' : 'Aucun dossier n’est en attente de décision.'} />
    </section>
    <Pagination page={result.page} limite={result.limite} total={result.total} onChange={(page) => void load(page)} buttonClassName={portal.secondary} rowClassName={portal.buttonRow} />
  </main>;
}
