'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Breadcrumbs from '../../_shared/Breadcrumbs';
import Button from '../../_shared/Button';
import Pagination from '../../_shared/Pagination';
import ResponsiveTable, { type ResponsiveColumn } from '../../_shared/ResponsiveTable';
import { useToast } from '../../_shared/Toast';
import portal from '../../entrepreneur/portal.module.css';
import styles from '../../agent/agent.module.css';

type Financing = {
  id: string; numeroFinancement: string; numeroDossier: string; raisonSociale: string; region?: string;
  montantAccorde: number; montantDecaisse: number; montantRembourse: number; impaye: number; statut: string;
};
type Eligible = { id: string; numeroDossier: string; raisonSociale: string; programme: string; montantApprouve: number; dureeMois: number };
type FinancingsResult = { items: Financing[]; total: number; page: number; limite: number };

function today() { return new Date().toISOString().slice(0, 10); }

export default function FinancingsPage() {
  const [result, setResult] = useState<FinancingsResult>({ items: [], total: 0, page: 1, limite: 25 });
  const [eligible, setEligible] = useState<Eligible[]>([]);
  const [selected, setSelected] = useState('');
  const [dateSignature, setDateSignature] = useState(today());
  const [dateDebut, setDateDebut] = useState(today());
  const [message, setMessage] = useState('');
  const { pushToast } = useToast();

  const load = useCallback(async (page = 1) => {
    const [financingResponse, eligibleResponse] = await Promise.all([
      fetch(`/api/direction/financements?page=${page}`, { cache: 'no-store' }),
      fetch('/api/direction/financements/eligibles', { cache: 'no-store' }),
    ]);
    const financingBody = await financingResponse.json();
    const eligibleBody = await eligibleResponse.json();
    if (!financingResponse.ok) throw new Error(financingBody.message ?? 'Chargement des financements impossible');
    if (!eligibleResponse.ok) throw new Error(eligibleBody.message ?? 'Chargement des décisions impossible');
    setResult(financingBody);
    setEligible(eligibleBody.items ?? []);
    setSelected((current) => current || eligibleBody.items?.[0]?.id || '');
  }, []);

  useEffect(() => { load(1).catch((error) => setMessage(error.message)); }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    const response = await fetch(`/api/direction/financements/applications/${selected}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dateSignature, dateDebut }),
    });
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.message ?? 'Création impossible');
      pushToast({ tone: 'error', title: 'Création impossible', message: 'Le financement n’a pas été créé. Vérifiez les informations puis réessayez.' });
      return;
    }
    setMessage(`Financement ${body.numeroFinancement} créé avec ${body.installments.length} échéances.`);
    pushToast({ tone: 'success', title: 'Financement créé', message: `Le financement ${body.numeroFinancement} et son échéancier ont été créés.` });
    await load(1);
  }

  const { items } = result;
  const committed = items.reduce((sum, item) => sum + item.montantAccorde, 0);
  const disbursed = items.reduce((sum, item) => sum + item.montantDecaisse, 0);
  const repaid = items.reduce((sum, item) => sum + item.montantRembourse, 0);

  const columns = useMemo<ResponsiveColumn<Financing>[]>(() => [
    {
      key: 'financement',
      header: 'Financement',
      render: (item) => <><strong>{item.numeroFinancement}</strong><br />{item.numeroDossier}</>,
    },
    {
      key: 'entreprise',
      header: 'Entreprise',
      render: (item) => <>{item.raisonSociale}<br />{item.region ?? '—'}</>,
    },
    { key: 'accorde', header: 'Accordé', render: (item) => `${item.montantAccorde.toLocaleString('fr-FR')} GNF` },
    { key: 'decaisse', header: 'Décaissé', render: (item) => `${item.montantDecaisse.toLocaleString('fr-FR')} GNF` },
    { key: 'rembourse', header: 'Remboursé', render: (item) => `${item.montantRembourse.toLocaleString('fr-FR')} GNF` },
    { key: 'impaye', header: 'Impayé', render: (item) => `${item.impaye.toLocaleString('fr-FR')} GNF` },
    { key: 'action', header: 'Action', render: (item) => <Button variant="outline" href={`/direction/financements/${item.id}`}>Gérer</Button> },
  ], []);

  return <main className={portal.main}>
    <Breadcrumbs items={[
      { label: 'Direction', href: '/direction/tableau-de-bord' },
      { label: 'Financements' },
    ]} />
    <p className={portal.eyebrow}>Direction FODIP</p><h1 className={portal.title}>Gestion des financements</h1>
    <p className={portal.lead}>Transformez les décisions approuvées en financements, puis pilotez décaissements, échéances, paiements et impact.</p>
    <div className={portal.buttonRow}><Button variant="outline" href="/direction/tableau-de-bord">Retour au cockpit</Button></div>
    <section className={styles.metrics}>
      <article className={`${portal.card} ${styles.metric}`}><strong>{result.total}</strong><span>Financements</span></article>
      <article className={`${portal.card} ${styles.metric}`}><strong>{committed.toLocaleString('fr-FR')}</strong><span>GNF accordés (page)</span></article>
      <article className={`${portal.card} ${styles.metric}`}><strong>{disbursed.toLocaleString('fr-FR')}</strong><span>GNF décaissés (page)</span></article>
      <article className={`${portal.card} ${styles.metric}`}><strong>{repaid.toLocaleString('fr-FR')}</strong><span>GNF remboursés (page)</span></article>
    </section>
    {message && <div className={`${portal.notice} ${portal.section}`} role="status">{message}</div>}

    <section className={`${portal.card} ${portal.formCard} ${portal.section}`}>
      <div className={portal.sectionHeader}><div><h2>Créer depuis une décision approuvée</h2><p>Le montant, le taux et la durée viennent exclusivement de la dernière décision du Comité.</p></div></div>
      {eligible.length ? <form onSubmit={create}>
        <div className={portal.formGrid}>
          <div className={`${portal.field} ${portal.fieldFull}`}><label htmlFor="application">Dossier approuvé</label><select id="application" required value={selected} onChange={(event) => setSelected(event.target.value)}>{eligible.map((item) => <option key={item.id} value={item.id}>{item.numeroDossier} · {item.raisonSociale} · {Number(item.montantApprouve).toLocaleString('fr-FR')} GNF · {item.dureeMois} mois</option>)}</select></div>
          <div className={portal.field}><label htmlFor="signature">Date de signature</label><input id="signature" type="date" required value={dateSignature} onChange={(event) => setDateSignature(event.target.value)} /></div>
          <div className={portal.field}><label htmlFor="debut">Début du financement</label><input id="debut" type="date" required value={dateDebut} onChange={(event) => setDateDebut(event.target.value)} /></div>
        </div><div className={portal.buttonRow}><Button type="submit" disabled={!selected}>Créer le financement et l’échéancier</Button></div>
      </form> : <p className={portal.lead}>Aucune décision approuvée n’attend la création d’un financement.</p>}
    </section>

    <section className={portal.section}>
      <ResponsiveTable
        rows={items}
        columns={columns}
        rowKey={(item) => item.id}
        caption="Financements FODIP"
        emptyMessage="Aucun financement n’est disponible pour le moment."
      />
    </section>
    <Pagination page={result.page} limite={result.limite} total={result.total} onChange={(page) => load(page).catch((error) => setMessage(error.message))} buttonClassName={portal.secondary} rowClassName={portal.buttonRow} />
  </main>;
}
