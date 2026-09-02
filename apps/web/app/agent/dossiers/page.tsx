'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Pagination from '../../_shared/Pagination';
import portal from '../../entrepreneur/portal.module.css';
import styles from '../agent.module.css';

type Dossier = { id: string; numeroDossier: string; raisonSociale: string; programmeNom?: string; montantDemande: string | number; statut: string; dateSoumission?: string; agentResponsableId?: string | null };
type Result = { items: Dossier[]; total: number; page: number; limite: number };

export default function AgentDossiersPage() {
  const [result, setResult] = useState<Result>({ items: [], total: 0, page: 1, limite: 25 });
  const [statut, setStatut] = useState('');
  const [recherche, setRecherche] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async (page = 1, status = statut, search = recherche) => {
    const query = new URLSearchParams();
    if (status) query.set('statut', status);
    if (search.trim()) query.set('recherche', search.trim());
    query.set('page', String(page));
    const response = await fetch(`/api/agent/dossiers?${query}`, { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body?.message ?? 'Chargement impossible');
    setResult(body);
  }, [recherche, statut]);

  useEffect(() => { load(1).catch((error) => setMessage(error.message)); }, [load]);
  const counts = useMemo(() => result.items.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.statut]: (acc[item.statut] ?? 0) + 1 }), {}), [result.items]);
  // A new filter always restarts from page 1: the previous page number may no longer exist once
  // the filtered result set shrinks (e.g. going from "Tous" to a status with fewer matches).
  function filter(event: FormEvent) { event.preventDefault(); setMessage(''); load(1).catch((error) => setMessage(error.message)); }

  return <main className={portal.main}>
    <p className={portal.eyebrow}>Portefeuille d’instruction</p><h1 className={portal.title}>Dossiers de financement</h1>
    <p className={portal.lead}>Priorisez les nouvelles demandes, prenez en charge un dossier et accédez à sa vue 360°.</p>
    <section className={styles.metrics}>
      <article className={`${portal.card} ${styles.metric}`}><strong>{result.total}</strong><span>Dossiers trouvés</span></article>
      <article className={`${portal.card} ${styles.metric}`}><strong>{counts.SOUMIS ?? 0}</strong><span>À prendre en charge (page)</span></article>
      <article className={`${portal.card} ${styles.metric}`}><strong>{counts.EN_INSTRUCTION ?? 0}</strong><span>En instruction (page)</span></article>
      <article className={`${portal.card} ${styles.metric}`}><strong>{counts.PRET_COMITE ?? 0}</strong><span>Prêts pour comité (page)</span></article>
    </section>
    <form className={`${portal.card} ${portal.formCard} ${portal.section} ${styles.filters}`} onSubmit={filter}>
      <div className={styles.filter}><label>Statut</label><select value={statut} onChange={(event) => setStatut(event.target.value)}><option value="">Tous</option><option value="SOUMIS">Soumis</option><option value="EN_INSTRUCTION">En instruction</option><option value="COMPLEMENT_REQUIS">Complément requis</option><option value="PRET_COMITE">Prêt comité</option></select></div>
      <div className={styles.filter}><label>Recherche</label><input value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder="N° dossier ou PME" /></div>
      <button className={portal.primary}>Filtrer</button>
    </form>
    {message && <div className={portal.notice}>{message}</div>}
    <section className={`${portal.card} ${portal.tableCard} ${portal.section}`}><table className={portal.table}><thead><tr><th>Dossier</th><th>Entreprise</th><th>Programme</th><th>Montant</th><th>Statut</th><th>Action</th></tr></thead><tbody>{result.items.map((dossier) => <tr key={dossier.id}><td><strong>{dossier.numeroDossier}</strong></td><td>{dossier.raisonSociale}</td><td>{dossier.programmeNom ?? '—'}</td><td>{Number(dossier.montantDemande).toLocaleString('fr-FR')} GNF</td><td><span className={portal.pill}>{dossier.statut}</span></td><td><Link className={portal.secondary} href={`/agent/dossiers/${dossier.id}`}>Vue 360°</Link></td></tr>)}</tbody></table>{result.items.length === 0 && <p className={portal.lead}>Aucun dossier ne correspond aux critères.</p>}</section>
    <Pagination page={result.page} limite={result.limite} total={result.total} onChange={(page) => load(page).catch((error) => setMessage(error.message))} buttonClassName={portal.secondary} rowClassName={portal.buttonRow} />
  </main>;
}
