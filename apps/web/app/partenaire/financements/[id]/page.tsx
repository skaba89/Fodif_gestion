'use client';

import Link from 'next/link';
import { FormEvent, use, useCallback, useEffect, useState } from 'react';
import portal from '../../../entrepreneur/portal.module.css';
import styles from '../../../agent/agent.module.css';

type Disbursement = { id: string; numeroDecaissement: number; montant: number; datePrevue: string; dateEffective?: string; referenceBancaire?: string; statut: string };
type Installment = { id: string; numeroEcheance: number; dateEcheance: string; montantTotalDu: number; montantPaye: number; resteAPayer: number; statut: string };
type Financing = {
  id: string; numeroFinancement: string; numeroDossier: string; raisonSociale: string;
  montantAccorde: number; tauxInteret: number; dureeMois: number; dateDebut: string; dateFinPrevue: string; statut: string;
  disbursements: Disbursement[]; installments: Installment[];
};

function today() { return new Date().toISOString().slice(0, 10); }
function amount(value: number) { return Number(value).toLocaleString('fr-FR'); }
function displayDate(value: string) { return new Intl.DateTimeFormat('fr-FR').format(new Date(value)); }

export default function PartnerFinancingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [financing, setFinancing] = useState<Financing | null>(null);
  const [message, setMessage] = useState('');
  const [disbursementAmount, setDisbursementAmount] = useState('');
  const [disbursementDate, setDisbursementDate] = useState(today());
  const [disbursementRef, setDisbursementRef] = useState('');
  const [installmentId, setInstallmentId] = useState('');
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [repaymentDate, setRepaymentDate] = useState(today());
  const [repaymentRef, setRepaymentRef] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('VIREMENT');

  const load = useCallback(async () => {
    const response = await fetch(`/api/partenaire/financements/${id}`, { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message ?? 'Chargement impossible');
    setFinancing(body);
    setInstallmentId((current) => current || body.installments.find((item: Installment) => item.resteAPayer > 0)?.id || '');
  }, [id]);

  useEffect(() => { load().catch((error) => setMessage(error.message)); }, [load]);

  async function post(path: string, payload: Record<string, unknown>, success: string) {
    setMessage('');
    const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await response.json();
    if (!response.ok) return setMessage(Array.isArray(body.message) ? body.message.join(', ') : body.message ?? 'Opération impossible');
    setFinancing(body); setMessage(success);
  }

  async function declareDisbursement(event: FormEvent) {
    event.preventDefault();
    await post(`/api/partenaire/financements/${id}/decaissements`, {
      montant: Number(disbursementAmount), dateEffective: disbursementDate, referenceBancaire: disbursementRef,
    }, 'Décaissement déclaré et audité.');
    setDisbursementAmount(''); setDisbursementRef('');
  }

  async function declareRepayment(event: FormEvent) {
    event.preventDefault();
    await post(`/api/partenaire/financements/${id}/remboursements`, {
      echeanceId: installmentId, montant: Number(repaymentAmount), datePaiement: repaymentDate,
      referencePaiement: repaymentRef || undefined, moyenPaiement: paymentMethod,
    }, 'Remboursement déclaré et échéance actualisée.');
    setRepaymentAmount(''); setRepaymentRef('');
  }

  if (!financing) return <main className={portal.main}><h1 className={portal.title}>Financement</h1><p className={portal.lead}>{message || 'Chargement…'}</p></main>;
  const disbursed = financing.disbursements.filter((item) => item.statut === 'EFFECTUE').reduce((sum, item) => sum + item.montant, 0);
  const committed = financing.disbursements.filter((item) => item.statut !== 'ANNULE').reduce((sum, item) => sum + item.montant, 0);
  const remainingDisbursement = Math.max(0, financing.montantAccorde - committed);
  const repaid = financing.installments.reduce((sum, item) => sum + item.montantPaye, 0);
  const openInstallments = financing.installments.filter((item) => item.resteAPayer > 0);

  return <main className={portal.main}>
    <p className={portal.eyebrow}>Exécution correspondante</p><h1 className={portal.title}>{financing.numeroFinancement}</h1>
    <p className={portal.lead}>{financing.raisonSociale} · {financing.numeroDossier} · <span className={portal.pill}>{financing.statut}</span></p>
    <div className={portal.buttonRow}><Link className={portal.secondary} href="/partenaire/financements">Retour au portefeuille</Link></div>
    {message && <div className={`${portal.notice} ${portal.section}`} role="status">{message}</div>}

    <section className={styles.metrics}>
      <article className={`${portal.card} ${styles.metric}`}><strong>{amount(financing.montantAccorde)}</strong><span>GNF accordés</span></article>
      <article className={`${portal.card} ${styles.metric}`}><strong>{amount(disbursed)}</strong><span>GNF décaissés</span></article>
      <article className={`${portal.card} ${styles.metric}`}><strong>{amount(repaid)}</strong><span>GNF remboursés</span></article>
      <article className={`${portal.card} ${styles.metric}`}><strong>{financing.tauxInteret}%</strong><span>{financing.dureeMois} mois</span></article>
    </section>

    <section className={`${portal.card} ${portal.formCard} ${portal.section}`}>
      <h2>Déclarer un décaissement</h2>
      <p className={portal.lead}>Enregistrez un paiement que votre établissement a déjà exécuté pour le compte du FODIP — disponible {amount(remainingDisbursement)} GNF.</p>
      {remainingDisbursement > 0 ? <form onSubmit={declareDisbursement}><div className={portal.formGrid}>
        <div className={portal.field}><label>Montant versé</label><input type="number" min="1" max={remainingDisbursement} required value={disbursementAmount} onChange={(event) => setDisbursementAmount(event.target.value)} /></div>
        <div className={portal.field}><label>Date d'exécution</label><input type="date" required value={disbursementDate} onChange={(event) => setDisbursementDate(event.target.value)} /></div>
        <div className={`${portal.field} ${portal.fieldFull}`}><label>Référence bancaire</label><input required minLength={3} value={disbursementRef} onChange={(event) => setDisbursementRef(event.target.value)} /></div>
      </div><div className={portal.buttonRow}><button className={portal.primary}>Déclarer le décaissement</button></div></form> : <p className={portal.lead}>Le montant accordé est intégralement décaissé.</p>}
    </section>

    <section className={`${portal.card} ${portal.tableCard} ${portal.section}`}><div className={portal.formCard}><h2>Décaissements</h2></div><table className={portal.table}><thead><tr><th>N°</th><th>Montant</th><th>Date</th><th>Statut</th><th>Référence</th></tr></thead><tbody>{financing.disbursements.map((item) => <tr key={item.id}><td>{item.numeroDecaissement}</td><td>{amount(item.montant)} GNF</td><td>{item.dateEffective ? displayDate(item.dateEffective) : displayDate(item.datePrevue)}</td><td><span className={portal.pill}>{item.statut}</span></td><td>{item.referenceBancaire ?? '—'}</td></tr>)}</tbody></table>{financing.disbursements.length === 0 && <div className={portal.formCard}><p className={portal.lead}>Aucun décaissement enregistré.</p></div>}</section>

    <section className={`${portal.card} ${portal.formCard} ${portal.section}`}>
      <h2>Déclarer un remboursement</h2>
      <p className={portal.lead}>Enregistrez un paiement que votre établissement a déjà collecté pour le compte du FODIP.</p>
      {openInstallments.length ? <form onSubmit={declareRepayment}><div className={portal.formGrid}>
        <div className={`${portal.field} ${portal.fieldFull}`}><label>Échéance</label><select required value={installmentId} onChange={(event) => setInstallmentId(event.target.value)}>{openInstallments.map((item) => <option key={item.id} value={item.id}>N° {item.numeroEcheance} · {displayDate(item.dateEcheance)} · reste {amount(item.resteAPayer)} GNF</option>)}</select></div>
        <div className={portal.field}><label>Montant collecté</label><input type="number" min="1" required value={repaymentAmount} onChange={(event) => setRepaymentAmount(event.target.value)} /></div>
        <div className={portal.field}><label>Date de collecte</label><input type="date" required value={repaymentDate} onChange={(event) => setRepaymentDate(event.target.value)} /></div>
        <div className={portal.field}><label>Moyen</label><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="VIREMENT">Virement</option><option value="CHEQUE">Chèque</option><option value="ESPECES">Espèces</option><option value="MOBILE_MONEY">Mobile Money</option><option value="AUTRE">Autre</option></select></div>
        <div className={portal.field}><label>Référence</label><input value={repaymentRef} onChange={(event) => setRepaymentRef(event.target.value)} /></div>
      </div><div className={portal.buttonRow}><button className={portal.primary}>Déclarer le remboursement</button></div></form> : <p className={portal.lead}>Toutes les échéances sont soldées.</p>}
    </section>

    <section className={`${portal.card} ${portal.tableCard} ${portal.section}`}><div className={portal.formCard}><h2>Échéancier</h2></div><table className={portal.table}><thead><tr><th>N°</th><th>Échéance</th><th>Total</th><th>Payé</th><th>Reste</th><th>Statut</th></tr></thead><tbody>{financing.installments.map((item) => <tr key={item.id}><td>{item.numeroEcheance}</td><td>{displayDate(item.dateEcheance)}</td><td>{amount(item.montantTotalDu)}</td><td>{amount(item.montantPaye)}</td><td>{amount(item.resteAPayer)}</td><td><span className={portal.pill}>{item.statut}</span></td></tr>)}</tbody></table></section>
  </main>;
}
