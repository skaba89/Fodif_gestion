'use client';

import { FormEvent, useEffect, useState } from 'react';
import { clientApi } from '../../lib/client-api';
import Button from './Button';
import { useToast } from './Toast';
import styles from '../entrepreneur/portal.module.css';

type ReferenceItem = { id: string; code: string; nom: string };
type References = { regions: ReferenceItem[]; secteurs: ReferenceItem[] };
type Proposal = {
  id: string;
  code: string;
  nom: string;
  statut: string;
  versionBrouillon?: number | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  workflowStatus: 'BROUILLON' | 'SOUMIS' | 'VALIDE';
};

function optionalNumber(value: string) {
  return value.trim() === '' ? null : Number(value);
}

export default function ProgramProposalPanel() {
  const [references, setReferences] = useState<References>({ regions: [], secteurs: [] });
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [enveloppe, setEnveloppe] = useState('');
  const [montantMin, setMontantMin] = useState('');
  const [montantMax, setMontantMax] = useState('');
  const [apportMinPct, setApportMinPct] = useState('');
  const [ancienneteMinMois, setAncienneteMinMois] = useState('');
  const [slaInstructionJours, setSlaInstructionJours] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [rccmRequis, setRccmRequis] = useState(false);
  const [nifRequis, setNifRequis] = useState(false);
  const [regionIds, setRegionIds] = useState<string[]>([]);
  const [secteurIds, setSecteurIds] = useState<string[]>([]);
  const { pushToast } = useToast();

  async function refresh() {
    const [referenceData, proposalData] = await Promise.all([
      clientApi<References>('/api/programme-references'),
      clientApi<Proposal[]>('/api/programme-proposals'),
    ]);
    setReferences(referenceData);
    setProposals(proposalData);
  }

  useEffect(() => {
    refresh().catch((error) => setMessage(error instanceof Error ? error.message : 'Chargement impossible'));
  }, []);

  function toggle(current: string[], value: string, setCurrent: (values: string[]) => void) {
    setCurrent(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  async function createProposal(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await clientApi('/api/programme-proposals', {
        method: 'POST',
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          nom: nom.trim(),
          description: description.trim() || undefined,
          enveloppeTotale: optionalNumber(enveloppe),
          montantMin: optionalNumber(montantMin),
          montantMax: optionalNumber(montantMax),
          apportMinPct: optionalNumber(apportMinPct),
          ancienneteMinMois: optionalNumber(ancienneteMinMois),
          slaInstructionJours: optionalNumber(slaInstructionJours),
          rccmRequis,
          nifRequis,
          dateDebut: dateDebut || null,
          dateFin: dateFin || null,
          regionIds,
          secteurIds,
          documents: [],
        }),
      });
      setCode(''); setNom(''); setDescription(''); setEnveloppe('');
      setMontantMin(''); setMontantMax(''); setApportMinPct(''); setAncienneteMinMois('');
      setSlaInstructionJours(''); setDateDebut(''); setDateFin(''); setRccmRequis(false); setNifRequis(false);
      setRegionIds([]); setSecteurIds([]);
      await refresh();
      pushToast({ tone: 'success', title: 'Proposition créée', message: 'Le brouillon reste modifiable avant sa soumission à la Direction.' });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Création impossible';
      setMessage(text);
      pushToast({ tone: 'error', title: 'Création refusée', message: text });
    } finally {
      setBusy(false);
    }
  }

  async function submitProposal(proposal: Proposal) {
    if (!proposal.versionBrouillon) return;
    setBusy(true);
    setMessage('');
    try {
      await clientApi(`/api/programme-proposals/${proposal.id}/versions/${proposal.versionBrouillon}/submit`, { method: 'POST' });
      await refresh();
      pushToast({ tone: 'success', title: 'Proposition soumise', message: 'La Direction FODIP peut maintenant la contrôler et la valider.' });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Soumission impossible';
      setMessage(text);
      pushToast({ tone: 'error', title: 'Soumission refusée', message: text });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`${styles.main} ${styles.section}`} aria-labelledby="program-proposal-title" data-testid="program-proposal-panel">
      <p className={styles.eyebrow}>Gouvernance des programmes</p>
      <h2 id="program-proposal-title">Proposer un nouveau programme</h2>
      <p className={styles.lead}>
        Préparez un programme et son périmètre. Il reste en brouillon puis doit être soumis à la Direction FODIP.
        Aucun programme proposé ici n’est publié automatiquement.
      </p>

      {message ? <div className={styles.notice} role="alert">{message}</div> : null}

      <form className={`${styles.card} ${styles.formCard}`} onSubmit={createProposal}>
        <div className={styles.formGrid}>
          <div className={styles.field}><label htmlFor="proposal-code">Code</label><input id="proposal-code" required value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="EX: PROGRAMME-PME-2026" /></div>
          <div className={styles.field}><label htmlFor="proposal-name">Nom</label><input id="proposal-name" required value={nom} onChange={(event) => setNom(event.target.value)} /></div>
          <div className={`${styles.field} ${styles.fieldFull}`}><label htmlFor="proposal-description">Description</label><textarea id="proposal-description" value={description} onChange={(event) => setDescription(event.target.value)} /></div>
          <div className={styles.field}><label htmlFor="proposal-envelope">Enveloppe (GNF)</label><input id="proposal-envelope" type="number" min="1" value={enveloppe} onChange={(event) => setEnveloppe(event.target.value)} /></div>
          <div className={styles.field}><label htmlFor="proposal-min">Montant minimum</label><input id="proposal-min" type="number" min="1" value={montantMin} onChange={(event) => setMontantMin(event.target.value)} /></div>
          <div className={styles.field}><label htmlFor="proposal-max">Montant maximum</label><input id="proposal-max" type="number" min="1" value={montantMax} onChange={(event) => setMontantMax(event.target.value)} /></div>
          <div className={styles.field}><label htmlFor="proposal-apport">Apport minimum (%)</label><input id="proposal-apport" type="number" min="0" max="100" value={apportMinPct} onChange={(event) => setApportMinPct(event.target.value)} /></div>
          <div className={styles.field}><label htmlFor="proposal-age">Ancienneté PME (mois)</label><input id="proposal-age" type="number" min="0" value={ancienneteMinMois} onChange={(event) => setAncienneteMinMois(event.target.value)} /></div>
          <div className={styles.field}><label htmlFor="proposal-sla">SLA instruction (jours)</label><input id="proposal-sla" type="number" min="1" value={slaInstructionJours} onChange={(event) => setSlaInstructionJours(event.target.value)} /></div>
          <div className={styles.field}><label htmlFor="proposal-start">Date de début</label><input id="proposal-start" type="date" value={dateDebut} onChange={(event) => setDateDebut(event.target.value)} /></div>
          <div className={styles.field}><label htmlFor="proposal-end">Date de fin</label><input id="proposal-end" type="date" value={dateFin} onChange={(event) => setDateFin(event.target.value)} /></div>
        </div>

        <div className={styles.section}>
          <h3>Régions concernées</h3>
          <p>Ne rien sélectionner signifie « toutes les régions ».</p>
          <div className={styles.programs}>
            {references.regions.map((region) => <label className={styles.card} key={region.id}><input type="checkbox" checked={regionIds.includes(region.id)} onChange={() => toggle(regionIds, region.id, setRegionIds)} /> {region.nom}</label>)}
          </div>
        </div>

        <div className={styles.section}>
          <h3>Secteurs concernés</h3>
          <p>Ne rien sélectionner signifie « tous les secteurs ».</p>
          <div className={styles.programs}>
            {references.secteurs.map((secteur) => <label className={styles.card} key={secteur.id}><input type="checkbox" checked={secteurIds.includes(secteur.id)} onChange={() => toggle(secteurIds, secteur.id, setSecteurIds)} /> {secteur.nom}</label>)}
          </div>
        </div>

        <div className={styles.buttonRow}>
          <label><input type="checkbox" checked={rccmRequis} onChange={(event) => setRccmRequis(event.target.checked)} /> RCCM requis</label>
          <label><input type="checkbox" checked={nifRequis} onChange={(event) => setNifRequis(event.target.checked)} /> NIF requis</label>
        </div>
        <div className={styles.buttonRow}><Button type="submit" loading={busy}>Enregistrer le brouillon</Button></div>
      </form>

      <div className={styles.section}>
        <div className={styles.sectionHeader}><div><h3>Mes propositions</h3><p>Suivi de la préparation jusqu’à la validation hiérarchique.</p></div></div>
        <div className={styles.programs}>
          {proposals.map((proposal) => (
            <article className={`${styles.card} ${styles.program}`} key={proposal.id} data-testid="program-proposal-card">
              <span className={styles.programTag}>{proposal.code}</span>
              <h3>{proposal.nom}</h3>
              <p><strong>État :</strong> {proposal.workflowStatus}</p>
              {proposal.workflowStatus === 'SOUMIS' ? <p>En attente de validation par la Direction FODIP.</p> : null}
              {proposal.workflowStatus === 'VALIDE' ? <p>Validé par la Direction. L’activation/publication reste contrôlée par la Direction.</p> : null}
              {proposal.workflowStatus === 'BROUILLON' && proposal.versionBrouillon ? (
                <div className={styles.buttonRow}><Button loading={busy} onClick={() => void submitProposal(proposal)}>Soumettre à la Direction</Button></div>
              ) : null}
            </article>
          ))}
          {!proposals.length ? <article className={`${styles.card} ${styles.program}`}><h3>Aucune proposition</h3><p>Vos nouveaux programmes apparaîtront ici avant soumission.</p></article> : null}
        </div>
      </div>
    </section>
  );
}
