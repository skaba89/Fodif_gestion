'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import Pagination from '../../_shared/Pagination';
import portal from '../../entrepreneur/portal.module.css';
import styles from '../../agent/agent.module.css';

type Financing = {
  id: string; numeroFinancement: string; numeroDossier: string; raisonSociale: string;
  montantAccorde: number; tauxInteret: number; dureeMois: number; dateDebut: string; dateFinPrevue: string; statut: string;
};
type Result = { items: Financing[]; total: number; page: number; limite: number };

export default function PartnerFinancingsPage() {
  const [result, setResult] = useState<Result>({ items: [], total: 0, page: 1, limite: 25 });
  const [message, setMessage] = useState('');

  const load = useCallback((page: number) => {
    fetch(`/api/partenaire/financements?page=${page}`, { cache: 'no-store' }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message ?? 'Chargement impossible');
      setResult(body);
    }).catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => { load(1); }, [load]);

  return <main className={portal.main}>
    <p className={portal.eyebrow}>Portefeuille correspondant</p><h1 className={portal.title}>Vos financements FODIP</h1>
    <p className={portal.lead}>Financements où votre établissement est banque correspondante ou dont l'entreprise fait partie de votre portefeuille client. Consultez l'échéancier et déclarez vos décaissements et remboursements.</p>
    <section className={styles.metrics}>
      <article className={`${portal.card} ${styles.metric}`}><strong>{result.total}</strong><span>Financements dans votre périmètre</span></article>
    </section>
    {message && <div className={portal.notice} role="status">{message}</div>}
    <section className={`${portal.card} ${portal.tableCard} ${portal.section}`} tabIndex={0} role="region" aria-label="Tableau, défilement horizontal sur petit écran"><table className={portal.table}><thead><tr><th>Financement</th><th>Entreprise</th><th>Accordé</th><th>Taux</th><th>Durée</th><th>Statut</th><th>Action</th></tr></thead><tbody>{result.items.map((item) => <tr key={item.id}><td><strong>{item.numeroFinancement}</strong><br />{item.numeroDossier}</td><td>{item.raisonSociale}</td><td>{item.montantAccorde.toLocaleString('fr-FR')} GNF</td><td>{item.tauxInteret}%</td><td>{item.dureeMois} mois</td><td><span className={portal.pill}>{item.statut}</span></td><td><Link className={portal.secondary} href={`/partenaire/financements/${item.id}`}>Gérer</Link></td></tr>)}</tbody></table>{result.items.length === 0 && <p className={portal.lead}>Aucun financement dans votre périmètre pour le moment.</p>}</section>
    <Pagination page={result.page} limite={result.limite} total={result.total} onChange={load} buttonClassName={portal.secondary} rowClassName={portal.buttonRow} />
  </main>;
}
