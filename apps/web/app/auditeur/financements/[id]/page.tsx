'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import Breadcrumbs from '../../../_shared/Breadcrumbs';
import { humanizeCode } from '../../../_shared/displayLabels';
import portal from '../../../entrepreneur/portal.module.css';
import styles from '../../../agent/agent.module.css';

type Disbursement = { id: string; numeroDecaissement: number; montant: number; datePrevue: string; dateEffective?: string; referenceBancaire?: string; statut: string };
type Installment = { id: string; numeroEcheance: number; dateEcheance: string; capitalDu: number; interetDu: number; montantTotalDu: number; montantPaye: number; resteAPayer: number; statut: string };
type Impact = { id: string; periode: string; chiffreAffaires?: number; nombreEmployes?: number; emploisCrees?: number; emploisMaintenus?: number };
type Audit = { id: string; action: string; newValues?: Record<string, unknown>; createdAt: string };
type Financing = {
  id: string; numeroFinancement: string; numeroDossier: string; raisonSociale: string; programme?: string; region?: string;
  montantAccorde: number; tauxInteret: number; dureeMois: number; dateDebut: string; dateFinPrevue: string; statut: string;
  disbursements: Disbursement[]; installments: Installment[]; impact: Impact[]; audit: Audit[];
};

function amount(value: number) { return Number(value).toLocaleString('fr-FR'); }
function displayDate(value: string) { return new Intl.DateTimeFormat('fr-FR').format(new Date(value)); }

/**
 * Read-only drill-down for the AUDITEUR role (issue #142: "drill-down dossier / financement /
 * opération" et "preuve chronologique d'un dossier ou financement"). Same data source as the
 * Direction cockpit (GET /financings/:id, which AUDITEUR already has financing.read for) but
 * with every mutating form stripped out — this page only ever renders, never posts.
 */
export default function AuditeurFinancingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [financing, setFinancing] = useState<Financing | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const response = await fetch(`/api/auditeur/financements/${id}`, { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message ?? 'Chargement impossible');
    setFinancing(body);
  }, [id]);

  useEffect(() => { load().catch((error) => setMessage(error.message)); }, [load]);

  if (!financing) return <main className={portal.main}><h1 className={portal.title}>Financement</h1><p className={portal.lead}>{message || 'Chargement…'}</p></main>;
  const disbursed = financing.disbursements.filter((item) => item.statut === 'EFFECTUE').reduce((sum, item) => sum + item.montant, 0);
  const repaid = financing.installments.reduce((sum, item) => sum + item.montantPaye, 0);

  return <main className={portal.main}>
    <Breadcrumbs items={[{ label: 'Auditeur', href: '/auditeur/tableau-de-bord' }, { label: financing.numeroFinancement }]} />
    <p className={portal.eyebrow}>Contrôle indépendant</p><h1 className={portal.title}>{financing.numeroFinancement}</h1>
    <p className={portal.lead}>{financing.raisonSociale} · {financing.numeroDossier} · <span className={portal.pill}>{humanizeCode(financing.statut)}</span></p>
    <div className={portal.buttonRow}><Link className={portal.secondary} href="/auditeur/tableau-de-bord">Retour à la supervision</Link></div>
    {message && <div className={`${portal.notice} ${portal.section}`} role="status">{message}</div>}

    <section className={styles.metrics}>
      <article className={`${portal.card} ${styles.metric}`}><strong>{amount(financing.montantAccorde)}</strong><span>GNF accordés</span></article>
      <article className={`${portal.card} ${styles.metric}`}><strong>{amount(disbursed)}</strong><span>GNF décaissés</span></article>
      <article className={`${portal.card} ${styles.metric}`}><strong>{amount(repaid)}</strong><span>GNF remboursés</span></article>
      <article className={`${portal.card} ${styles.metric}`}><strong>{financing.tauxInteret}%</strong><span>{financing.dureeMois} mois</span></article>
    </section>

    <section className={`${portal.card} ${styles.panel}`}><h2>Contrat</h2><div className={styles.facts}><div className={styles.fact}><span>Programme</span><strong>{financing.programme ?? '—'}</strong></div><div className={styles.fact}><span>Région</span><strong>{financing.region ?? '—'}</strong></div><div className={styles.fact}><span>Début</span><strong>{displayDate(financing.dateDebut)}</strong></div><div className={styles.fact}><span>Fin prévue</span><strong>{displayDate(financing.dateFinPrevue)}</strong></div></div></section>

    <section className={`${portal.card} ${portal.tableCard} ${portal.section}`} tabIndex={0} role="region" aria-label="Tableau, défilement horizontal sur petit écran"><div className={portal.formCard}><h2>Tranches de décaissement</h2></div><table className={portal.table}><thead><tr><th>N°</th><th>Montant</th><th>Date prévue</th><th>Statut</th><th>Confirmation bancaire</th></tr></thead><tbody>{financing.disbursements.map((item) => <tr key={item.id}><td>{item.numeroDecaissement}</td><td>{amount(item.montant)} GNF</td><td>{displayDate(item.datePrevue)}</td><td><span className={portal.pill}>{humanizeCode(item.statut)}</span></td><td>{item.referenceBancaire ?? '—'}</td></tr>)}</tbody></table>{financing.disbursements.length === 0 && <div className={portal.formCard}><p className={portal.lead}>Aucun décaissement planifié.</p></div>}</section>

    <section className={`${portal.card} ${portal.tableCard} ${portal.section}`} tabIndex={0} role="region" aria-label="Tableau, défilement horizontal sur petit écran"><div className={portal.formCard}><h2>Échéancier</h2></div><table className={portal.table}><thead><tr><th>N°</th><th>Échéance</th><th>Capital</th><th>Intérêt</th><th>Total</th><th>Payé</th><th>Reste</th><th>Statut</th></tr></thead><tbody>{financing.installments.map((item) => <tr key={item.id}><td>{item.numeroEcheance}</td><td>{displayDate(item.dateEcheance)}</td><td>{amount(item.capitalDu)}</td><td>{amount(item.interetDu)}</td><td>{amount(item.montantTotalDu)}</td><td>{amount(item.montantPaye)}</td><td>{amount(item.resteAPayer)}</td><td><span className={portal.pill}>{humanizeCode(item.statut)}</span></td></tr>)}</tbody></table></section>

    <div className={styles.detailGrid}>
      <section className={`${portal.card} ${styles.panel}`}><h2>Historique d’impact</h2><div className={styles.history}>{financing.impact.map((item) => <div className={styles.historyItem} key={item.id}><strong>{displayDate(item.periode)} · {item.nombreEmployes ?? '—'} employés</strong><span>{amount(item.chiffreAffaires ?? 0)} GNF de CA · {item.emploisCrees ?? 0} emplois créés · {item.emploisMaintenus ?? 0} maintenus</span></div>)}{financing.impact.length === 0 && <p className={portal.lead}>Aucun suivi enregistré.</p>}</div></section>
      <section className={`${portal.card} ${styles.panel}`}><h2>Journal d’audit</h2><div className={styles.history}>{financing.audit.map((item) => <div className={styles.historyItem} key={item.id}><strong>{humanizeCode(item.action)}</strong><span>{displayDate(item.createdAt)}</span></div>)}{financing.audit.length === 0 && <p className={portal.lead}>Aucune opération auditée.</p>}</div></section>
    </div>
  </main>;
}
