'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Breadcrumbs from '../../_shared/Breadcrumbs';
import Button from '../../_shared/Button';
import FilterBar, { FilterField } from '../../_shared/FilterBar';
import KpiCard from '../../_shared/KpiCard';
import Pagination from '../../_shared/Pagination';
import ResponsiveTable, { type ResponsiveColumn } from '../../_shared/ResponsiveTable';
import { DossierStatusBadge } from '../../_shared/StatusBadge';
import role from '../../_shared/RoleDashboard.module.css';
import portal from '../../entrepreneur/portal.module.css';
import styles from '../agent.module.css';

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

const STATUS_PRIORITY: Record<string, number> = {
  SOUMIS: 0,
  EN_INSTRUCTION: 1,
  COMPLEMENT_REQUIS: 2,
  PRET_COMITE: 3,
};

function submittedAt(dossier: Dossier) {
  return dossier.dateSoumission ? new Date(dossier.dateSoumission).getTime() : Number.MAX_SAFE_INTEGER;
}

export default function AgentDossiersPage() {
  const router = useRouter();
  const [result, setResult] = useState<Result>({ items: [], total: 0, page: 1, limite: 25 });
  const [statut, setStatut] = useState('');
  const [recherche, setRecherche] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('priorite');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);

  const load = useCallback(async (page = 1, status = '', search = '') => {
    setLoading(true);
    const query = new URLSearchParams();
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

  useEffect(() => { load(1).catch((error) => setMessage(error.message)); }, [load]);

  const counts = useMemo(() => result.items.reduce<Record<string, number>>(
    (acc, item) => ({ ...acc, [item.statut]: (acc[item.statut] ?? 0) + 1 }),
    {},
  ), [result.items]);

  const actionableCount = (counts.SOUMIS ?? 0) + (counts.EN_INSTRUCTION ?? 0) + (counts.COMPLEMENT_REQUIS ?? 0);

  const sortedRows = useMemo(() => [...result.items].sort((left, right) => {
    if (sortMode === 'montant') return Number(right.montantDemande) - Number(left.montantDemande);
    if (sortMode === 'anciennete') return submittedAt(left) - submittedAt(right);
    const statusDelta = (STATUS_PRIORITY[left.statut] ?? 9) - (STATUS_PRIORITY[right.statut] ?? 9);
    return statusDelta !== 0 ? statusDelta : submittedAt(left) - submittedAt(right);
  }), [result.items, sortMode]);

  const startInstruction = useCallback(async (dossier: Dossier) => {
    setMessage('');
    setStartingId(dossier.id);
    try {
      if (!dossier.agentResponsableId) {
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
    load(1, statut, recherche).catch((error) => setMessage(error.message));
  }

  function resetFilters() {
    setStatut('');
    setRecherche('');
    setMessage('');
    load(1, '', '').catch((error) => setMessage(error.message));
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
      render: (dossier) => (
        <Button
          onClick={() => void startInstruction(dossier)}
          loading={startingId === dossier.id}
          disabled={startingId !== null && startingId !== dossier.id}
        >
          {dossier.agentResponsableId ? 'Continuer' : 'Prendre et instruire'}
        </Button>
      ),
    },
  ], [startInstruction, startingId]);

  const activeFilterCount = Number(Boolean(statut)) + Number(Boolean(recherche.trim()));
  const nextDossier = sortedRows[0];

  return <main className={portal.main}>
    <Breadcrumbs items={[{ label: 'Agent', href: '/agent/dossiers' }, { label: 'Dossiers' }]} />

    <div className={role.pageHeader}>
      <div>
        <p className={portal.eyebrow}>Portefeuille d’instruction</p>
        <h1 className={portal.title}>Dossiers à traiter</h1>
        <p className={portal.lead}>Commencez par l’action attendue, puis utilisez les filtres seulement si nécessaire.</p>
      </div>
    </div>

    <section className={role.priorityCard} aria-labelledby="agent-priority-title">
      <div className={role.priorityMain}>
        <p className={role.priorityLabel}>Priorité de travail</p>
        <h2 className={role.priorityTitle} id="agent-priority-title">{actionableCount} dossier{actionableCount > 1 ? 's' : ''} à traiter sur cette page</h2>
        <p className={role.priorityDescription}>Les dossiers soumis à prendre en charge sont placés en premier, puis les instructions en cours. À priorité égale, les plus anciens remontent avant les plus récents.</p>
        <div className={role.queueSummary}>
          <span>{counts.SOUMIS ?? 0} à prendre en charge</span>
          <span>{counts.EN_INSTRUCTION ?? 0} en instruction</span>
          <span>{counts.COMPLEMENT_REQUIS ?? 0} avec complément</span>
          <span>{counts.PRET_COMITE ?? 0} prêts comité</span>
        </div>
      </div>
      <aside className={role.priorityAside}>
        <div className={role.nextAction}><span>Action recommandée</span><strong>Prendre le premier dossier prioritaire et ouvrir directement son poste d’instruction.</strong></div>
        {nextDossier ? (
          <Button onClick={() => void startInstruction(nextDossier)} loading={startingId === nextDossier.id} disabled={startingId !== null && startingId !== nextDossier.id}>
            {nextDossier.agentResponsableId ? 'Continuer le prochain dossier' : 'Prendre et instruire le prochain dossier'}
          </Button>
        ) : null}
        <p className={portal.lead}>Pour un dossier non attribué, la prise en charge et l’ouverture sont regroupées en une seule action.</p>
      </aside>
    </section>

    <section className={`${styles.metrics} ${portal.section}`} aria-label="Synthèse du portefeuille d’instruction">
      <KpiCard label="Dossiers trouvés" value={String(result.total)} definition="Nombre total de dossiers correspondant aux filtres actuels, toutes pages confondues." />
      <KpiCard label="À prendre en charge" value={String(counts.SOUMIS ?? 0)} definition="Dossiers soumis visibles sur la page courante et encore à prendre en charge." />
      <KpiCard label="En instruction" value={String(counts.EN_INSTRUCTION ?? 0)} definition="Dossiers actuellement en instruction sur la page courante." />
      <KpiCard label="Prêts pour comité" value={String(counts.PRET_COMITE ?? 0)} definition="Dossiers prêts à être transmis au comité sur la page courante." />
    </section>

    <form className={portal.section} onSubmit={filter}>
      <FilterBar activeCount={activeFilterCount} onReset={resetFilters} actions={<Button type="submit">Filtrer</Button>} ariaLabel="Filtres des dossiers à instruire">
        <FilterField label="Statut" htmlFor="statut">
          <select id="statut" value={statut} onChange={(event) => setStatut(event.target.value)}>
            <option value="">Tous les statuts</option>
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
        <div><h2>File d’instruction</h2><p className={portal.lead}>La pagination serveur limite l’affichage à 25 dossiers par page, ce qui évite de rendre plus de 100 lignes sur les appareils modestes.</p></div>
      </div>
      <ResponsiveTable
        rows={sortedRows}
        columns={columns}
        rowKey={(dossier) => dossier.id}
        caption="Dossiers de financement à instruire"
        emptyMessage={loading ? 'Chargement de la file…' : 'Aucun dossier ne correspond aux critères.'}
      />
    </section>
    <Pagination page={result.page} limite={result.limite} total={result.total} onChange={(page) => load(page, statut, recherche).catch((error) => setMessage(error.message))} buttonClassName={portal.secondary} rowClassName={portal.buttonRow} />
  </main>;
}
