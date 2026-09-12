'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Breadcrumbs from '../../_shared/Breadcrumbs';
import Button from '../../_shared/Button';
import FilterBar, { FilterField } from '../../_shared/FilterBar';
import Pagination from '../../_shared/Pagination';
import ResponsiveTable, { type ResponsiveColumn } from '../../_shared/ResponsiveTable';
import { DossierStatusBadge } from '../../_shared/StatusBadge';
import role from '../../_shared/RoleDashboard.module.css';
import portal from '../../entrepreneur/portal.module.css';

type Dossier = {
  id: string;
  numeroDossier: string;
  raisonSociale: string;
  programmeNom?: string;
  montantDemande: string | number;
  statut: string;
  dateSoumission?: string;
  agentResponsableId?: string | null;
};
type Result = { items: Dossier[]; total: number; page: number; limite: number };
type SortMode = 'priorite' | 'anciennete' | 'montant';
type ViewMode = 'A_PRENDRE' | 'MES_DOSSIERS' | 'COMPLEMENTS' | 'PRET_COMITE' | 'HISTORIQUE';

const VALID_VIEWS: ViewMode[] = ['A_PRENDRE', 'MES_DOSSIERS', 'COMPLEMENTS', 'PRET_COMITE', 'HISTORIQUE'];
const VIEW_COPY: Record<ViewMode, { title: string; description: string }> = {
  A_PRENDRE: { title: 'Dossiers à prendre en charge', description: 'Dossiers soumis qui ne sont encore affectés à aucun agent.' },
  MES_DOSSIERS: { title: 'Mes dossiers en cours', description: 'Dossiers affectés à votre compte et encore en instruction.' },
  COMPLEMENTS: { title: 'Compléments à suivre', description: 'Vos dossiers pour lesquels un complément a été demandé à la PME.' },
  PRET_COMITE: { title: 'Dossiers prêts comité', description: 'Dossiers que vous avez instruits et transmis au comité de financement.' },
  HISTORIQUE: { title: 'Historique de traitement', description: 'Dossiers sur lesquels votre compte Agent a déjà effectué une transition métier.' },
};

const STATUS_PRIORITY: Record<string, number> = {
  SOUMIS: 0,
  COMPLEMENT_REQUIS: 1,
  EN_INSTRUCTION: 2,
  PRET_COMITE: 3,
};

function submittedAt(dossier: Dossier) {
  return dossier.dateSoumission ? new Date(dossier.dateSoumission).getTime() : Number.MAX_SAFE_INTEGER;
}

function viewFromLocation(): ViewMode {
  if (typeof window === 'undefined') return 'A_PRENDRE';
  const candidate = new URLSearchParams(window.location.search).get('vue') as ViewMode | null;
  return candidate && VALID_VIEWS.includes(candidate) ? candidate : 'A_PRENDRE';
}

export default function AgentDossiersPage() {
  const router = useRouter();
  const [result, setResult] = useState<Result>({ items: [], total: 0, page: 1, limite: 25 });
  const [statut, setStatut] = useState('');
  const [recherche, setRecherche] = useState('');
  const [vue, setVue] = useState<ViewMode>('A_PRENDRE');
  const [initialized, setInitialized] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('priorite');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);

  const load = useCallback(async (page = 1, status = '', search = '', view: ViewMode = 'A_PRENDRE') => {
    setLoading(true);
    const query = new URLSearchParams();
    query.set('vue', view);
    if (status) query.set('statut', status);
    if (search.trim()) query.set('recherche', search.trim());
    query.set('page', String(page));
    try {
      const response = await fetch(`/api/agent/dossiers?${query}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message ?? 'Chargement impossible');
      setResult(body);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setVue(viewFromLocation());
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!initialized) return;
    setStatut('');
    setMessage('');
    load(1, '', recherche, vue).catch((error) => setMessage(error.message));
  }, [initialized, load, vue]);

  const sortedRows = useMemo(() => [...result.items].sort((left, right) => {
    if (sortMode === 'montant') return Number(right.montantDemande) - Number(left.montantDemande);
    if (sortMode === 'anciennete') return submittedAt(left) - submittedAt(right);
    const statusDelta = (STATUS_PRIORITY[left.statut] ?? 9) - (STATUS_PRIORITY[right.statut] ?? 9);
    return statusDelta !== 0 ? statusDelta : submittedAt(left) - submittedAt(right);
  }), [result.items, sortMode]);

  const openDossier = useCallback(async (dossier: Dossier) => {
    setMessage('');
    setStartingId(dossier.id);
    try {
      const shouldClaim = dossier.statut === 'SOUMIS' && !dossier.agentResponsableId;
      if (shouldClaim) {
        if (!navigator.onLine) throw new Error('Connexion requise pour prendre en charge un dossier.');
        const response = await fetch(`/api/agent/dossiers/${dossier.id}/claim`, { method: 'POST' });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.message ?? 'Prise en charge impossible');
      }
      router.push(`/agent/dossiers/${dossier.id}`);
    } catch (error) {
      setStartingId(null);
      setMessage(error instanceof Error ? error.message : 'Ouverture impossible');
    }
  }, [router]);

  function filter(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    load(1, statut, recherche, vue).catch((error) => setMessage(error.message));
  }

  function resetFilters() {
    setStatut('');
    setRecherche('');
    setMessage('');
    load(1, '', '', vue).catch((error) => setMessage(error.message));
  }

  function changeView(next: ViewMode) {
    setVue(next);
    router.replace(`/agent/dossiers?vue=${next}`, { scroll: false });
  }

  const columns = useMemo<ResponsiveColumn<Dossier>[]>(() => [
    {
      key: 'priorite',
      header: 'Priorité',
      render: (dossier) => dossier.statut === 'SOUMIS'
        ? <span className={role.priorityHigh}>À prendre</span>
        : <span className={role.priorityNormal}>{dossier.statut === 'EN_INSTRUCTION' ? 'En cours' : 'Suivi'}</span>,
    },
    { key: 'dossier', header: 'Dossier', render: (dossier) => <strong>{dossier.numeroDossier}</strong> },
    { key: 'entreprise', header: 'Entreprise', render: (dossier) => dossier.raisonSociale },
    { key: 'programme', header: 'Programme', render: (dossier) => dossier.programmeNom ?? '—' },
    { key: 'montant', header: 'Montant demandé', render: (dossier) => `${Number(dossier.montantDemande).toLocaleString('fr-FR')} GNF` },
    {
      key: 'anciennete',
      header: 'Soumis le',
      render: (dossier) => dossier.dateSoumission ? new Date(dossier.dateSoumission).toLocaleDateString('fr-FR') : '—',
    },
    { key: 'statut', header: 'Statut', render: (dossier) => <DossierStatusBadge status={dossier.statut} /> },
    {
      key: 'action',
      header: 'Action',
      render: (dossier) => {
        const canClaim = dossier.statut === 'SOUMIS' && !dossier.agentResponsableId;
        return <Button
          onClick={() => void openDossier(dossier)}
          loading={startingId === dossier.id}
          disabled={startingId !== null && startingId !== dossier.id}
        >
          {canClaim ? 'Prendre et instruire' : 'Ouvrir'}
        </Button>;
      },
    },
  ], [openDossier, startingId]);

  const activeFilterCount = Number(Boolean(statut)) + Number(Boolean(recherche.trim()));
  const nextDossier = sortedRows[0];
  const copy = VIEW_COPY[vue];

  return <main className={portal.main}>
    <Breadcrumbs items={[{ label: 'Agent', href: '/agent/tableau-de-bord' }, { label: 'Dossiers' }]} />

    <div className={role.pageHeader}>
      <div>
        <p className={portal.eyebrow}>Portefeuille d’instruction</p>
        <h1 className={portal.title}>{copy.title}</h1>
        <p className={portal.lead}>{copy.description}</p>
      </div>
    </div>

    <section className={role.priorityCard} aria-labelledby="agent-priority-title">
      <div className={role.priorityMain}>
        <p className={role.priorityLabel}>Vue de travail</p>
        <h2 className={role.priorityTitle} id="agent-priority-title">{result.total} dossier{result.total > 1 ? 's' : ''}</h2>
        <p className={role.priorityDescription}>{copy.description} Le périmètre personnel est appliqué côté serveur à partir de votre session.</p>
      </div>
      <aside className={role.priorityAside}>
        <div className={role.nextAction}><span>Prochaine action</span><strong>{nextDossier ? `Ouvrir ${nextDossier.numeroDossier}` : 'Aucune action requise dans cette vue.'}</strong></div>
        {nextDossier ? <Button onClick={() => void openDossier(nextDossier)} loading={startingId === nextDossier.id} disabled={startingId !== null && startingId !== nextDossier.id}>
          {nextDossier.statut === 'SOUMIS' && !nextDossier.agentResponsableId ? 'Prendre et instruire' : 'Ouvrir le dossier'}
        </Button> : null}
      </aside>
    </section>

    <form className={portal.section} onSubmit={filter}>
      <FilterBar activeCount={activeFilterCount} onReset={resetFilters} actions={<Button type="submit">Filtrer</Button>} ariaLabel="Filtres des dossiers à instruire">
        <FilterField label="Vue" htmlFor="vue-agent">
          <select id="vue-agent" value={vue} onChange={(event) => changeView(event.target.value as ViewMode)}>
            <option value="A_PRENDRE">À prendre</option>
            <option value="MES_DOSSIERS">Mes dossiers</option>
            <option value="COMPLEMENTS">Compléments</option>
            <option value="PRET_COMITE">Prêts comité</option>
            <option value="HISTORIQUE">Historique</option>
          </select>
        </FilterField>
        <FilterField label="Statut" htmlFor="statut">
          <select id="statut" value={statut} onChange={(event) => setStatut(event.target.value)}>
            <option value="">Tous les statuts de la vue</option>
            <option value="SOUMIS">Soumis</option>
            <option value="EN_INSTRUCTION">En instruction</option>
            <option value="COMPLEMENT_REQUIS">Compléments requis</option>
            <option value="PRET_COMITE">Prêt pour le comité</option>
          </select>
        </FilterField>
        <FilterField label="Recherche" htmlFor="recherche">
          <input id="recherche" type="search" value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder="N° dossier ou PME" />
        </FilterField>
        <FilterField label="Trier" htmlFor="tri-agent">
          <select id="tri-agent" value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
            <option value="priorite">Priorité métier</option>
            <option value="anciennete">Plus anciens d’abord</option>
            <option value="montant">Montant décroissant</option>
          </select>
        </FilterField>
      </FilterBar>
    </form>

    {message ? <div className={`${portal.notice} ${portal.section}`} role="status">{message}</div> : null}

    <section className={portal.section} aria-busy={loading}>
      <div className={role.queueToolbar}>
        <div><h2>File d’instruction</h2><p className={portal.lead}>Pagination serveur limitée à 25 dossiers par page et bascule en cartes sur les écrans étroits.</p></div>
      </div>
      <ResponsiveTable
        rows={sortedRows}
        columns={columns}
        rowKey={(dossier) => dossier.id}
        caption="Dossiers de financement à instruire"
        emptyMessage={loading ? 'Chargement de la file…' : 'Aucun dossier ne correspond aux critères.'}
      />
    </section>
    <Pagination page={result.page} limite={result.limite} total={result.total} onChange={(page) => load(page, statut, recherche, vue).catch((error) => setMessage(error.message))} buttonClassName={portal.secondary} rowClassName={portal.buttonRow} />
  </main>;
}
