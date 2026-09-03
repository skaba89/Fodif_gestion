'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import Pagination from '../../_shared/Pagination';
import portal from '../../entrepreneur/portal.module.css';
import styles from '../../agent/agent.module.css';

type Item = { id: string; numeroDossier: string; raisonSociale: string; programmeNom?: string; montantDemande: number | string; scoreTotal?: number | string; niveauRisque?: string; recommandation?: string };
type Result = { items: Item[]; total: number; page: number; limite: number };

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
  return <main className={portal.main}>
    <p className={portal.eyebrow}>Séance décisionnelle</p><h1 className={portal.title}>Dossiers prêts pour le comité</h1>
    <p className={portal.lead}>Analysez le dossier complet, son scoring explicable et les pièces vérifiées avant toute décision.</p>
    <section className={styles.metrics}>
      <article className={`${portal.card} ${styles.metric}`}><strong>{result.total}</strong><span>Dossiers à statuer</span></article>
      <article className={`${portal.card} ${styles.metric}`}><strong>{amount.toLocaleString('fr-FR')}</strong><span>GNF demandés (page)</span></article>
      <article className={`${portal.card} ${styles.metric}`}><strong>{items.filter((item) => item.niveauRisque === 'FAIBLE').length}</strong><span>Risque faible (page)</span></article>
      <article className={`${portal.card} ${styles.metric}`}><strong>{items.filter((item) => item.niveauRisque === 'ELEVE').length}</strong><span>Risque élevé (page)</span></article>
    </section>
    {message && <div className={`${portal.notice} ${portal.section}`}>{message}</div>}
    <section className={`${portal.card} ${portal.tableCard} ${portal.section}`} tabIndex={0} role="region" aria-label="Tableau, défilement horizontal sur petit écran"><table className={portal.table}><thead><tr><th>Dossier</th><th>Entreprise</th><th>Programme</th><th>Montant</th><th>Score</th><th>Risque</th><th>Action</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.numeroDossier}</strong></td><td>{item.raisonSociale}</td><td>{item.programmeNom ?? '—'}</td><td>{Number(item.montantDemande).toLocaleString('fr-FR')} GNF</td><td>{item.scoreTotal ?? '—'}/100</td><td><span className={portal.pill}>{item.niveauRisque ?? '—'}</span></td><td><Link className={portal.secondary} href={`/comite/dossiers/${item.id}`}>Examiner</Link></td></tr>)}</tbody></table>{items.length === 0 && <p className={portal.lead}>Aucun dossier en attente de décision.</p>}</section>
    <Pagination page={result.page} limite={result.limite} total={result.total} onChange={load} buttonClassName={portal.secondary} rowClassName={portal.buttonRow} />
  </main>;
}
