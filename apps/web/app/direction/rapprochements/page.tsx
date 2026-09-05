'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import Pagination from '../../_shared/Pagination';
import portal from '../../entrepreneur/portal.module.css';
import styles from '../../agent/agent.module.css';

type Bank = { id: string; code: string; nom: string };
type Candidate = {
  id: string; operationType: 'DECAISSEMENT' | 'REMBOURSEMENT'; sens: 'DEBIT' | 'CREDIT';
  banqueId: string; banqueNom: string; numeroFinancement: string; raisonSociale: string;
  montant: number; dateOperation: string; reference?: string;
};
type StatementEntry = {
  id: string; banqueId: string; banqueNom: string; referenceExterne: string; dateOperation: string;
  sens: 'DEBIT' | 'CREDIT'; montant: number; libelle?: string; statut: 'A_RAPPROCHER' | 'RAPPROCHE';
  rapprochementId?: string; rapprocheAt?: string; numeroFinancement?: string; raisonSociale?: string;
  referenceOperation?: string; montantOperation?: number;
};
type Overview = {
  items: StatementEntry[]; total: number; page: number; limite: number;
  summary: { total: number; rapproches: number; aRapprocher: number; montantARapprocher: number };
  candidates: Candidate[]; banks: Bank[];
};

function today() { return new Date().toISOString().slice(0, 10); }
function amount(value: number) { return Number(value).toLocaleString('fr-FR'); }
function displayDate(value?: string) {
  return value ? new Intl.DateTimeFormat('fr-FR').format(new Date(value)) : '—';
}

export default function BankReconciliationsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [page, setPage] = useState(1);
  const [bankFilter, setBankFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('A_RAPPROCHER');
  const [message, setMessage] = useState('');
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, string>>({});
  const [bankId, setBankId] = useState('');
  const [reference, setReference] = useState('');
  const [operationDate, setOperationDate] = useState(today());
  const [direction, setDirection] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [statementAmount, setStatementAmount] = useState('');
  const [description, setDescription] = useState('');
  const [entryKey, setEntryKey] = useState(() => crypto.randomUUID());

  const load = useCallback(async (requestedPage: number) => {
    const params = new URLSearchParams({ page: String(requestedPage), limite: '25' });
    if (bankFilter) params.set('banqueId', bankFilter);
    if (statusFilter) params.set('statut', statusFilter);
    const response = await fetch(`/api/direction/rapprochements?${params}`, { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message ?? 'Chargement du rapprochement bancaire impossible');
    setOverview(body);
    setPage(requestedPage);
    setBankId((current) => current || body.banks[0]?.id || '');
  }, [bankFilter, statusFilter]);

  useEffect(() => { load(1).catch((error) => setMessage(error.message)); }, [load]);

  async function createEntry(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    const response = await fetch('/api/direction/rapprochements', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': entryKey },
      body: JSON.stringify({
        banqueId: bankId, referenceExterne: reference, dateOperation: operationDate,
        sens: direction, montant: Number(statementAmount), libelle: description || undefined,
      }),
    });
    const body = await response.json();
    if (!response.ok) return setMessage(Array.isArray(body.message) ? body.message.join(', ') : body.message);
    setReference(''); setStatementAmount(''); setDescription(''); setEntryKey(crypto.randomUUID());
    setStatusFilter('A_RAPPROCHER'); setMessage('Mouvement bancaire enregistré et prêt à être rapproché.');
    await load(1);
  }

  async function matchEntry(event: FormEvent, entryId: string) {
    event.preventDefault();
    const selection = selectedCandidates[entryId];
    if (!selection) return setMessage('Sélectionnez une opération financière compatible.');
    const [operationType, operationId] = selection.split(':');
    const response = await fetch(`/api/direction/rapprochements/${entryId}/rapprocher`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ operationType, operationId }),
    });
    const body = await response.json();
    if (!response.ok) return setMessage(Array.isArray(body.message) ? body.message.join(', ') : body.message);
    setMessage('Mouvement et opération rapprochés avec succès.');
    setSelectedCandidates((current) => ({ ...current, [entryId]: '' }));
    await load(page);
  }

  function exactCandidates(entry: StatementEntry) {
    return overview?.candidates.filter((candidate) =>
      candidate.banqueId === entry.banqueId
      && candidate.sens === entry.sens
      && Number(candidate.montant) === Number(entry.montant)) ?? [];
  }

  return <main className={portal.main}>
    <p className={portal.eyebrow}>Intégrité financière</p>
    <h1 className={portal.title}>Rapprochement bancaire</h1>
    <p className={portal.lead}>Contrôlez que chaque décaissement et remboursement enregistré dans FODIP correspond à un mouvement réellement constaté par la banque partenaire.</p>
    <div className={portal.buttonRow}>
      <Link className={portal.secondary} href="/direction/tableau-de-bord">Retour au cockpit</Link>
      <Link className={portal.secondary} href="/direction/financements">Financements</Link>
    </div>

    <section className={styles.metrics}>
      <article className={`${portal.card} ${styles.metric}`}><strong>{overview?.summary.total ?? 0}</strong><span>Mouvements importés</span></article>
      <article className={`${portal.card} ${styles.metric}`}><strong>{overview?.summary.rapproches ?? 0}</strong><span>Rapprochés</span></article>
      <article className={`${portal.card} ${styles.metric}`}><strong>{overview?.summary.aRapprocher ?? 0}</strong><span>À rapprocher</span></article>
      <article className={`${portal.card} ${styles.metric}`}><strong>{amount(overview?.summary.montantARapprocher ?? 0)}</strong><span>GNF non rapprochés</span></article>
    </section>
    {message && <div className={`${portal.notice} ${portal.section}`} role="status">{message}</div>}

    <section className={`${portal.card} ${portal.formCard} ${portal.section}`}>
      <div className={portal.sectionHeader}><div><h2>Ajouter un mouvement du relevé</h2><p>La référence doit être unique pour la banque sélectionnée. Ce lot traite les opérations en GNF.</p></div></div>
      <form onSubmit={createEntry}>
        <div className={portal.formGrid}>
          <div className={portal.field}><label htmlFor="statementBank">Banque partenaire</label><select id="statementBank" required value={bankId} onChange={(event) => setBankId(event.target.value)}><option value="">Sélectionner</option>{overview?.banks.map((bank) => <option key={bank.id} value={bank.id}>{bank.nom}</option>)}</select></div>
          <div className={portal.field}><label htmlFor="statementReference">Référence bancaire</label><input id="statementReference" required maxLength={255} value={reference} onChange={(event) => setReference(event.target.value)} /></div>
          <div className={portal.field}><label htmlFor="statementDate">Date d’opération</label><input id="statementDate" type="date" required value={operationDate} onChange={(event) => setOperationDate(event.target.value)} /></div>
          <div className={portal.field}><label htmlFor="statementDirection">Sens</label><select id="statementDirection" value={direction} onChange={(event) => setDirection(event.target.value as 'DEBIT' | 'CREDIT')}><option value="DEBIT">Débit — décaissement</option><option value="CREDIT">Crédit — remboursement</option></select></div>
          <div className={portal.field}><label htmlFor="statementAmount">Montant (GNF)</label><input id="statementAmount" type="number" min="0.01" step="0.01" required value={statementAmount} onChange={(event) => setStatementAmount(event.target.value)} /></div>
          <div className={portal.field}><label htmlFor="statementDescription">Libellé</label><input id="statementDescription" maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} /></div>
        </div>
        <div className={portal.buttonRow}><button className={portal.primary}>Enregistrer le mouvement</button></div>
      </form>
    </section>

    <section className={`${portal.card} ${portal.formCard} ${portal.section}`}>
      <div className={portal.sectionHeader}><div><h2>File de contrôle</h2><p>Seules les opérations de même banque, même sens et même montant sont proposées.</p></div></div>
      <div className={portal.formGrid}>
        <div className={portal.field}><label htmlFor="bankFilter">Banque</label><select id="bankFilter" value={bankFilter} onChange={(event) => setBankFilter(event.target.value)}><option value="">Toutes les banques</option>{overview?.banks.map((bank) => <option key={bank.id} value={bank.id}>{bank.nom}</option>)}</select></div>
        <div className={portal.field}><label htmlFor="statusFilter">Statut</label><select id="statusFilter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="A_RAPPROCHER">À rapprocher</option><option value="RAPPROCHE">Rapproché</option><option value="">Tous</option></select></div>
      </div>
    </section>

    <section className={`${portal.card} ${portal.tableCard} ${portal.section}`} tabIndex={0} role="region" aria-label="Tableau des mouvements bancaires">
      <table className={portal.table}><thead><tr><th>Mouvement</th><th>Banque</th><th>Sens</th><th>Montant</th><th>Statut</th><th>Contrôle</th></tr></thead>
        <tbody>{overview?.items.map((entry) => {
          const candidates = exactCandidates(entry);
          return <tr key={entry.id}>
            <td><strong>{entry.referenceExterne}</strong><br />{displayDate(entry.dateOperation)}{entry.libelle ? <><br />{entry.libelle}</> : null}</td>
            <td>{entry.banqueNom}</td><td>{entry.sens === 'DEBIT' ? 'Débit' : 'Crédit'}</td>
            <td><strong>{amount(entry.montant)} GNF</strong></td><td><span className={portal.pill}>{entry.statut === 'RAPPROCHE' ? 'Rapproché' : 'À rapprocher'}</span></td>
            <td>{entry.statut === 'RAPPROCHE'
              ? <span>{entry.numeroFinancement} · {entry.raisonSociale}<br />Réf. {entry.referenceOperation ?? '—'} · {displayDate(entry.rapprocheAt)}</span>
              : candidates.length > 0
                ? <form onSubmit={(event) => matchEntry(event, entry.id)}><div className={portal.field}><label htmlFor={`candidate-${entry.id}`}>Opération correspondante</label><select id={`candidate-${entry.id}`} required value={selectedCandidates[entry.id] ?? ''} onChange={(event) => setSelectedCandidates((current) => ({ ...current, [entry.id]: event.target.value }))}><option value="">Sélectionner</option>{candidates.map((candidate) => <option key={`${candidate.operationType}-${candidate.id}`} value={`${candidate.operationType}:${candidate.id}`}>{candidate.numeroFinancement} · {candidate.raisonSociale} · {displayDate(candidate.dateOperation)} · {candidate.reference ?? 'sans référence'}</option>)}</select></div><div className={portal.buttonRow}><button className={portal.primary}>Rapprocher</button></div></form>
                : <span>Aucune opération exacte disponible. Contrôlez la banque, le sens ou le montant.</span>}</td>
          </tr>;
        })}</tbody></table>
      {overview?.items.length === 0 && <div className={portal.formCard}><p className={portal.lead}>Aucun mouvement ne correspond aux filtres sélectionnés.</p></div>}
    </section>
    {overview && <Pagination page={overview.page} limite={overview.limite} total={overview.total} onChange={(next) => load(next).catch((error) => setMessage(error.message))} buttonClassName={portal.secondary} rowClassName={portal.buttonRow} />}
  </main>;
}
