'use client';

import Link from 'next/link';
import { FormEvent, use, useCallback, useEffect, useState } from 'react';
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

function today() { return new Date().toISOString().slice(0, 10); }
function amount(value: number) { return Number(value).toLocaleString('fr-FR'); }
function displayDate(value: string) { return new Intl.DateTimeFormat('fr-FR').format(new Date(value)); }

export default function FinancingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [financing, setFinancing] = useState<Financing | null>(null);
  const [message, setMessage] = useState('');
  const [disbursementAmount, setDisbursementAmount] = useState('');
  const [plannedDate, setPlannedDate] = useState(today());
  const [executionRefs, setExecutionRefs] = useState<Record<string, string>>({});
  const [installmentId, setInstallmentId] = useState('');
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [repaymentDate, setRepaymentDate] = useState(today());
  const [repaymentRef, setRepaymentRef] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('VIREMENT');
  const [impactPeriod, setImpactPeriod] = useState(today());
  const [employees, setEmployees] = useState('');
  const [women, setWomen] = useState('');
  const [men, setMen] = useState('');
  const [young, setYoung] = useState('');
  const [jobsCreated, setJobsCreated] = useState('');
  const [jobsMaintained, setJobsMaintained] = useState('');
  const [revenue, setRevenue] = useState('');
  // Axe E5 (docs/14-ROADMAP-SAAS-PREMIUM.md, intégrité financière) - one Idempotency-Key per
  // submission intent, sent as a header (see lib/backend.ts#idempotencyKeyHeaders and
  // apps/api/src/common/idempotency.service.ts for the actual enforcement). Regenerated only
  // after a successful submission, so a double-click or a network retry of the same in-flight
  // request reuses the same key and cannot create a second décaissement/remboursement, while a
  // genuinely new submission (after the previous one succeeded) gets a fresh one.
  const [disbursementKey, setDisbursementKey] = useState(() => crypto.randomUUID());
  const [repaymentKey, setRepaymentKey] = useState(() => crypto.randomUUID());

  const load = useCallback(async () => {
    const response = await fetch(`/api/direction/financements/${id}`, { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message ?? 'Chargement impossible');
    setFinancing(body);
    setInstallmentId((current) => current || body.installments.find((item: Installment) => item.resteAPayer > 0)?.id || '');
  }, [id]);

  useEffect(() => { load().catch((error) => setMessage(error.message)); }, [load]);

  async function post(path: string, payload: Record<string, unknown>, success: string, idempotencyKey?: string) {
    setMessage('');
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
    const response = await fetch(path, { method: 'POST', headers, body: JSON.stringify(payload) });
    const body = await response.json();
    if (!response.ok) return setMessage(Array.isArray(body.message) ? body.message.join(', ') : body.message ?? 'Opération impossible');
    setFinancing(body); setMessage(success);
    return true;
  }

  async function planDisbursement(event: FormEvent) {
    event.preventDefault();
    const done = await post(
      `/api/direction/financements/${id}/decaissements`, { montant: Number(disbursementAmount), datePrevue: plannedDate },
      'Décaissement planifié et audité.', disbursementKey,
    );
    if (done) { setDisbursementAmount(''); setDisbursementKey(crypto.randomUUID()); }
  }

  async function executeDisbursement(event: FormEvent, disbursementId: string) {
    event.preventDefault();
    await post(`/api/direction/financements/${id}/decaissements/${disbursementId}/execute`, {
      dateEffective: today(), referenceBancaire: executionRefs[disbursementId] ?? '',
    }, 'Décaissement confirmé et intégré au cockpit.');
  }

  async function createRepayment(event: FormEvent) {
    event.preventDefault();
    const done = await post(`/api/direction/financements/${id}/remboursements`, {
      echeanceId: installmentId, montant: Number(repaymentAmount), datePaiement: repaymentDate,
      referencePaiement: repaymentRef || undefined, moyenPaiement: paymentMethod,
    }, 'Remboursement enregistré et échéance actualisée.', repaymentKey);
    if (done) { setRepaymentAmount(''); setRepaymentRef(''); setRepaymentKey(crypto.randomUUID()); }
  }

  async function saveImpact(event: FormEvent) {
    event.preventDefault();
    const optionalNumber = (value: string) => value === '' ? undefined : Number(value);
    await post(`/api/direction/financements/${id}/impact`, {
      periode: impactPeriod, chiffreAffaires: optionalNumber(revenue), nombreEmployes: optionalNumber(employees),
      emploisFemmes: optionalNumber(women), emploisHommes: optionalNumber(men), emploisJeunes: optionalNumber(young),
      emploisCrees: optionalNumber(jobsCreated), emploisMaintenus: optionalNumber(jobsMaintained),
    }, 'Snapshot d’impact enregistré.');
  }

  if (!financing) return <main className={portal.main}><h1 className={portal.title}>Financement</h1><p className={portal.lead}>{message || 'Chargement…'}</p></main>;
  const disbursed = financing.disbursements.filter((item) => item.statut === 'EFFECTUE').reduce((sum, item) => sum + item.montant, 0);
  const repaid = financing.installments.reduce((sum, item) => sum + item.montantPaye, 0);
  const remainingDisbursement = financing.montantAccorde - financing.disbursements.filter((item) => item.statut !== 'ANNULE').reduce((sum, item) => sum + item.montant, 0);
  const openInstallments = financing.installments.filter((item) => item.resteAPayer > 0);

  return <main className={portal.main}>
    <p className={portal.eyebrow}>Cycle post-comité</p><h1 className={portal.title}>{financing.numeroFinancement}</h1>
    <p className={portal.lead}>{financing.raisonSociale} · {financing.numeroDossier} · <span className={portal.pill}>{financing.statut}</span></p>
    <div className={portal.buttonRow}><Link className={portal.secondary} href="/direction/financements">Retour aux financements</Link><Link className={portal.secondary} href="/direction/tableau-de-bord">Cockpit</Link></div>
    {message && <div className={`${portal.notice} ${portal.section}`} role="status">{message}</div>}

    <section className={styles.metrics}>
      <article className={`${portal.card} ${styles.metric}`}><strong>{amount(financing.montantAccorde)}</strong><span>GNF accordés</span></article>
      <article className={`${portal.card} ${styles.metric}`}><strong>{amount(disbursed)}</strong><span>GNF décaissés</span></article>
      <article className={`${portal.card} ${styles.metric}`}><strong>{amount(repaid)}</strong><span>GNF remboursés</span></article>
      <article className={`${portal.card} ${styles.metric}`}><strong>{financing.tauxInteret}%</strong><span>{financing.dureeMois} mois</span></article>
    </section>

    <div className={styles.detailGrid}>
      <section className={`${portal.card} ${styles.panel}`}><h2>Décaissements</h2><form className={styles.review} onSubmit={planDisbursement}><div className={portal.field}><label htmlFor="planDisbursementAmount">Montant à planifier — disponible {amount(Math.max(0, remainingDisbursement))} GNF</label><input id="planDisbursementAmount" type="number" min="1" max={Math.max(0, remainingDisbursement)} required value={disbursementAmount} onChange={(event) => setDisbursementAmount(event.target.value)} /></div><div className={portal.field}><label htmlFor="plannedDate">Date prévue</label><input id="plannedDate" type="date" required value={plannedDate} onChange={(event) => setPlannedDate(event.target.value)} /></div><button className={portal.primary} disabled={remainingDisbursement <= 0}>Planifier</button></form></section>
      <section className={`${portal.card} ${styles.panel}`}><h2>Contrat</h2><div className={styles.facts}><div className={styles.fact}><span>Programme</span><strong>{financing.programme ?? '—'}</strong></div><div className={styles.fact}><span>Région</span><strong>{financing.region ?? '—'}</strong></div><div className={styles.fact}><span>Début</span><strong>{displayDate(financing.dateDebut)}</strong></div><div className={styles.fact}><span>Fin prévue</span><strong>{displayDate(financing.dateFinPrevue)}</strong></div></div></section>
    </div>

    <section className={`${portal.card} ${portal.tableCard} ${portal.section}`} tabIndex={0} role="region" aria-label="Tableau, défilement horizontal sur petit écran"><div className={portal.formCard}><h2>Tranches de décaissement</h2></div><table className={portal.table}><thead><tr><th>N°</th><th>Montant</th><th>Date prévue</th><th>Statut</th><th>Confirmation bancaire</th></tr></thead><tbody>{financing.disbursements.map((item) => <tr key={item.id}><td>{item.numeroDecaissement}</td><td>{amount(item.montant)} GNF</td><td>{displayDate(item.datePrevue)}</td><td><span className={portal.pill}>{item.statut}</span></td><td>{item.statut === 'PREVU' ? <form className={styles.filters} onSubmit={(event) => executeDisbursement(event, item.id)}><div className={styles.filter}><label htmlFor={`ref-${item.id}`}>Référence</label><input id={`ref-${item.id}`} required minLength={3} value={executionRefs[item.id] ?? ''} onChange={(event) => setExecutionRefs((current) => ({ ...current, [item.id]: event.target.value }))} /></div><button className={portal.primary}>Confirmer aujourd’hui</button></form> : item.referenceBancaire ?? '—'}</td></tr>)}</tbody></table>{financing.disbursements.length === 0 && <div className={portal.formCard}><p className={portal.lead}>Aucun décaissement planifié.</p></div>}</section>

    <section className={`${portal.card} ${portal.formCard} ${portal.section}`}><h2>Enregistrer un remboursement</h2>{openInstallments.length ? <form onSubmit={createRepayment}><div className={portal.formGrid}><div className={`${portal.field} ${portal.fieldFull}`}><label htmlFor="directionInstallmentId">Échéance</label><select id="directionInstallmentId" required value={installmentId} onChange={(event) => setInstallmentId(event.target.value)}>{openInstallments.map((item) => <option key={item.id} value={item.id}>N° {item.numeroEcheance} · {displayDate(item.dateEcheance)} · reste {amount(item.resteAPayer)} GNF</option>)}</select></div><div className={portal.field}><label htmlFor="directionRepaymentAmount">Montant payé</label><input id="directionRepaymentAmount" type="number" min="1" required value={repaymentAmount} onChange={(event) => setRepaymentAmount(event.target.value)} /></div><div className={portal.field}><label htmlFor="directionRepaymentDate">Date de paiement</label><input id="directionRepaymentDate" type="date" required value={repaymentDate} onChange={(event) => setRepaymentDate(event.target.value)} /></div><div className={portal.field}><label htmlFor="directionPaymentMethod">Moyen</label><select id="directionPaymentMethod" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="VIREMENT">Virement</option><option value="CHEQUE">Chèque</option><option value="ESPECES">Espèces</option><option value="MOBILE_MONEY">Mobile Money</option><option value="AUTRE">Autre</option></select></div><div className={portal.field}><label htmlFor="directionRepaymentRef">Référence</label><input id="directionRepaymentRef" value={repaymentRef} onChange={(event) => setRepaymentRef(event.target.value)} /></div></div><div className={portal.buttonRow}><button className={portal.primary}>Enregistrer le paiement</button></div></form> : <p className={portal.lead}>Toutes les échéances sont soldées.</p>}</section>

    <section className={`${portal.card} ${portal.tableCard} ${portal.section}`} tabIndex={0} role="region" aria-label="Tableau, défilement horizontal sur petit écran"><div className={portal.formCard}><h2>Échéancier</h2></div><table className={portal.table}><thead><tr><th>N°</th><th>Échéance</th><th>Capital</th><th>Intérêt</th><th>Total</th><th>Payé</th><th>Reste</th><th>Statut</th></tr></thead><tbody>{financing.installments.map((item) => <tr key={item.id}><td>{item.numeroEcheance}</td><td>{displayDate(item.dateEcheance)}</td><td>{amount(item.capitalDu)}</td><td>{amount(item.interetDu)}</td><td>{amount(item.montantTotalDu)}</td><td>{amount(item.montantPaye)}</td><td>{amount(item.resteAPayer)}</td><td><span className={portal.pill}>{item.statut}</span></td></tr>)}</tbody></table></section>

    <section className={`${portal.card} ${portal.formCard} ${portal.section}`}><h2>Snapshot d’impact</h2><p className={portal.lead}>Une nouvelle saisie sur la même période remplace le snapshot précédent et conserve une trace d’audit.</p><form onSubmit={saveImpact}><div className={portal.formGrid}><div className={portal.field}><label htmlFor="impactPeriod">Période</label><input id="impactPeriod" type="date" required value={impactPeriod} onChange={(event) => setImpactPeriod(event.target.value)} /></div><div className={portal.field}><label htmlFor="revenue">Chiffre d’affaires (GNF)</label><input id="revenue" type="number" min="0" value={revenue} onChange={(event) => setRevenue(event.target.value)} /></div><div className={portal.field}><label htmlFor="employees">Employés</label><input id="employees" type="number" min="0" value={employees} onChange={(event) => setEmployees(event.target.value)} /></div><div className={portal.field}><label htmlFor="women">Femmes</label><input id="women" type="number" min="0" value={women} onChange={(event) => setWomen(event.target.value)} /></div><div className={portal.field}><label htmlFor="men">Hommes</label><input id="men" type="number" min="0" value={men} onChange={(event) => setMen(event.target.value)} /></div><div className={portal.field}><label htmlFor="young">Jeunes</label><input id="young" type="number" min="0" value={young} onChange={(event) => setYoung(event.target.value)} /></div><div className={portal.field}><label htmlFor="jobsCreated">Emplois créés</label><input id="jobsCreated" type="number" min="0" value={jobsCreated} onChange={(event) => setJobsCreated(event.target.value)} /></div><div className={portal.field}><label htmlFor="jobsMaintained">Emplois maintenus</label><input id="jobsMaintained" type="number" min="0" value={jobsMaintained} onChange={(event) => setJobsMaintained(event.target.value)} /></div></div><div className={portal.buttonRow}><button className={portal.primary}>Enregistrer l’impact</button></div></form></section>

    <div className={styles.detailGrid}>
      <section className={`${portal.card} ${styles.panel}`}><h2>Historique d’impact</h2><div className={styles.history}>{financing.impact.map((item) => <div className={styles.historyItem} key={item.id}><strong>{displayDate(item.periode)} · {item.nombreEmployes ?? '—'} employés</strong><span>{amount(item.chiffreAffaires ?? 0)} GNF de CA · {item.emploisCrees ?? 0} emplois créés · {item.emploisMaintenus ?? 0} maintenus</span></div>)}{financing.impact.length === 0 && <p className={portal.lead}>Aucun suivi enregistré.</p>}</div></section>
      <section className={`${portal.card} ${styles.panel}`}><h2>Journal d’audit</h2><div className={styles.history}>{financing.audit.map((item) => <div className={styles.historyItem} key={item.id}><strong>{item.action}</strong><span>{displayDate(item.createdAt)}</span></div>)}{financing.audit.length === 0 && <p className={portal.lead}>Aucune opération auditée.</p>}</div></section>
    </div>
  </main>;
}
