'use client';

import Link from 'next/link';
import { FormEvent, use, useCallback, useEffect, useState } from 'react';
import Breadcrumbs from '../../../_shared/Breadcrumbs';
import Button from '../../../_shared/Button';
import { DossierStatusBadge, RiskBadge } from '../../../_shared/StatusBadge';
import portal from '../../../entrepreneur/portal.module.css';
import styles from '../../../agent/agent.module.css';
import committee from '../../comite.module.css';

type ScoreCriterion = {
  code: string; libelle: string; categorie?: string; poids: number | string;
  scoreObtenu: number | string; scoreMax: number | string; contribution: number | string; commentaire?: string;
};
type Dossier = {
  id: string; numeroDossier: string; statut: string; raisonSociale: string; codeFodip: string;
  rccm?: string; nif?: string; nombreEmployes?: number; chiffreAffairesAnnuel?: number | string;
  programmeNom?: string; montantDemande: number | string; apportPersonnel: number | string;
  objetFinancement: string; descriptionProjet?: string; nombreEmploisPrevus: number;
  score: null | { scoreTotal: number | string; niveauRisque: string; recommandation: string; modeleNom: string; modeleVersion: number; criteres: ScoreCriterion[] };
  documents: Array<{ id: string; typeDocument: string; nomFichier: string; statutVerification: string }>;
  decisions: Array<{ decision: string; montantApprouve?: number | string; tauxInteret?: number | string; dureeMois?: number; commentaire?: string; dateDecision: string }>;
  historique: Array<{ ancienStatut?: string; nouveauStatut: string; commentaire?: string; changedAt: string; acteurNom?: string }>;
};

function formatAmount(value?: number | string) {
  return value === undefined || value === null ? '—' : `${Number(value).toLocaleString('fr-FR')} GNF`;
}

export default function CommitteeApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [decision, setDecision] = useState('APPROUVE');
  const [montant, setMontant] = useState('');
  const [duree, setDuree] = useState('36');
  const [taux, setTaux] = useState('');
  const [differe, setDiffere] = useState('0');
  const [commentaire, setCommentaire] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const response = await fetch(`/api/comite/dossiers/${id}`, { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.message ?? 'Chargement impossible');
    setDossier(body);
    setMontant(String(body.montantDemande ?? ''));
  }, [id]);

  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : 'Chargement impossible')); }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!confirmed) return;
    setSubmitting(true); setMessage('');
    const payload = decision === 'APPROUVE'
      ? { decision, montantApprouve: Number(montant), dureeMois: Number(duree), tauxInteret: taux ? Number(taux) : undefined, differeMois: Number(differe), commentaire }
      : { decision, commentaire };
    try {
      const response = await fetch(`/api/comite/dossiers/${id}/decision`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message ?? 'Décision impossible');
      setDossier(body); setMessage('Décision du comité enregistrée et auditée.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Décision impossible');
    } finally {
      setSubmitting(false);
    }
  }

  if (!dossier) return <main className={portal.main}><h1 className={portal.title}>Comité</h1><p className={portal.lead}>{message || 'Chargement…'}</p></main>;
  const verifiedDocuments = dossier.documents.filter((document) => document.statutVerification === 'VALIDE').length;

  return <main className={portal.main}>
    <Breadcrumbs items={[{ label: 'Comité', href: '/comite/tableau-de-bord' }, { label: 'Ordre du jour', href: '/comite/dossiers?vue=ORDRE_DU_JOUR' }, { label: dossier.numeroDossier }]} />
    <p className={portal.eyebrow}>Dossier décisionnel</p>
    <h1 className={portal.title}>{dossier.numeroDossier}</h1>
    <p className={portal.lead}>{dossier.raisonSociale} · <DossierStatusBadge status={dossier.statut} /></p>
    <div className={`${portal.buttonRow} ${committee.screenActions}`}>
      <Link className={portal.secondary} href="/comite/dossiers?vue=ORDRE_DU_JOUR">Retour à l’ordre du jour</Link>
      <Button variant="outline" onClick={() => window.print()}>Imprimer la synthèse</Button>
    </div>
    {message && <div className={`${portal.notice} ${portal.section}`} role="status">{message}</div>}

    <div className={styles.detailGrid}>
      <section className={`${portal.card} ${styles.panel}`}>
        <h2>Entreprise et projet</h2>
        <div className={styles.facts}>
          <div className={styles.fact}><span>PME</span><strong>{dossier.raisonSociale}</strong></div>
          <div className={styles.fact}><span>Code FODIP</span><strong>{dossier.codeFodip}</strong></div>
          <div className={styles.fact}><span>RCCM</span><strong>{dossier.rccm ?? '—'}</strong></div>
          <div className={styles.fact}><span>NIF</span><strong>{dossier.nif ?? '—'}</strong></div>
          <div className={styles.fact}><span>Effectif actuel</span><strong>{dossier.nombreEmployes ?? '—'}</strong></div>
          <div className={styles.fact}><span>Chiffre d’affaires</span><strong>{formatAmount(dossier.chiffreAffairesAnnuel)}</strong></div>
          <div className={styles.fact}><span>Montant demandé</span><strong>{formatAmount(dossier.montantDemande)}</strong></div>
          <div className={styles.fact}><span>Apport personnel</span><strong>{formatAmount(dossier.apportPersonnel)}</strong></div>
          <div className={styles.fact}><span>Programme</span><strong>{dossier.programmeNom ?? '—'}</strong></div>
          <div className={styles.fact}><span>Emplois prévus</span><strong>{dossier.nombreEmploisPrevus}</strong></div>
        </div>
        <h3>{dossier.objetFinancement}</h3><p className={portal.lead}>{dossier.descriptionProjet ?? '—'}</p>
      </section>
      <section className={`${portal.card} ${styles.panel}`}>
        <h2>Score d’aide à la décision</h2>
        {dossier.score ? <>
          <div className={styles.facts}>
            <div className={styles.fact}><span>Score</span><strong>{dossier.score.scoreTotal}/100</strong></div>
            <div className={styles.fact}><span>Risque</span><strong><RiskBadge level={dossier.score.niveauRisque} /></strong></div>
            <div className={styles.fact}><span>Recommandation</span><strong>{dossier.score.recommandation}</strong></div>
            <div className={styles.fact}><span>Modèle</span><strong>{dossier.score.modeleNom} v{dossier.score.modeleVersion}</strong></div>
          </div>
          <p className={portal.lead}>Le score est explicable et consultatif. Le comité reste seul responsable de la décision finale.</p>
        </> : <p className={portal.lead}>Aucun score disponible.</p>}
      </section>
    </div>

    {dossier.score && <section className={`${portal.card} ${portal.tableCard} ${portal.section}`} tabIndex={0} role="region" aria-label="Détail explicable du scoring">
      <table className={portal.table}><caption>Détail du score présenté au comité</caption><thead><tr><th>Critère</th><th>Note</th><th>Contribution</th><th>Justification</th></tr></thead><tbody>{dossier.score.criteres.map((item) => <tr key={item.code}><td>{item.libelle}</td><td>{item.scoreObtenu}/{item.scoreMax}</td><td>{Number(item.contribution).toFixed(2)}</td><td>{item.commentaire || '—'}</td></tr>)}</tbody></table>
    </section>}

    <div className={styles.detailGrid}>
      <section className={`${portal.card} ${styles.panel}`}>
        <h2>Pièces du dossier</h2>
        <p className={portal.lead}>{verifiedDocuments} pièce{verifiedDocuments > 1 ? 's' : ''} validée{verifiedDocuments > 1 ? 's' : ''} sur {dossier.documents.length} version{dossier.documents.length > 1 ? 's' : ''} courante{dossier.documents.length > 1 ? 's' : ''}.</p>
        <div className={styles.history}>{dossier.documents.length ? dossier.documents.map((document) => <div className={styles.historyItem} key={document.id}><strong>{document.typeDocument} · {document.statutVerification}</strong><span>{document.nomFichier}</span></div>) : <p className={portal.lead}>Aucune pièce courante.</p>}</div>
      </section>
      <section className={`${portal.card} ${styles.panel}`}>
        <h2>Chronologie d’instruction</h2>
        <div className={styles.history}>{dossier.historique.length ? dossier.historique.map((event, index) => <div className={styles.historyItem} key={`${event.changedAt}-${index}`}><strong>{event.ancienStatut ? `${event.ancienStatut} → ` : ''}{event.nouveauStatut}</strong><span>{new Date(event.changedAt).toLocaleString('fr-FR')} · {event.acteurNom ?? 'Système'}</span>{event.commentaire ? <span>{event.commentaire}</span> : null}</div>) : <p className={portal.lead}>Aucune transition antérieure enregistrée.</p>}</div>
      </section>
    </div>

    {dossier.decisions.length ? <section className={`${portal.card} ${styles.panel} ${portal.section}`}>
      <h2>Décisions enregistrées</h2>
      <div className={styles.history}>{dossier.decisions.map((item, index) => <div className={styles.historyItem} key={`${item.dateDecision}-${index}`}><strong>{item.decision} · {item.montantApprouve ? formatAmount(item.montantApprouve) : 'Sans montant approuvé'}</strong><span>{new Date(item.dateDecision).toLocaleString('fr-FR')}{item.dureeMois ? ` · ${item.dureeMois} mois` : ''}</span>{item.commentaire ? <span>{item.commentaire}</span> : null}</div>)}</div>
    </section> : null}

    <section className={`${portal.card} ${portal.formCard} ${portal.section} ${committee.decisionForm}`}>
      <h2>Décision humaine</h2>
      {dossier.statut === 'PRET_COMITE' ? <form className={`${styles.review} ${portal.section}`} onSubmit={submit}>
        <label htmlFor="decision">Décision</label>
        <select id="decision" value={decision} onChange={(event) => { setDecision(event.target.value); setConfirmed(false); }}><option value="APPROUVE">Approuver</option><option value="COMPLEMENT_REQUIS">Demander un complément</option><option value="REJETE">Rejeter</option></select>
        {decision === 'APPROUVE' && <div className={portal.formGrid}>
          <div className={portal.field}><label htmlFor="montantApprouve">Montant approuvé (GNF)</label><input id="montantApprouve" type="number" min="1" max={Number(dossier.montantDemande)} required value={montant} onChange={(event) => setMontant(event.target.value)} /></div>
          <div className={portal.field}><label htmlFor="dureeMois">Durée (mois)</label><input id="dureeMois" type="number" min="1" max="120" required value={duree} onChange={(event) => setDuree(event.target.value)} /></div>
          <div className={portal.field}><label htmlFor="tauxInteret">Taux d’intérêt (%)</label><input id="tauxInteret" type="number" min="0" max="100" step="0.0001" value={taux} onChange={(event) => setTaux(event.target.value)} /></div>
          <div className={portal.field}><label htmlFor="differeMois">Différé (mois)</label><input id="differeMois" type="number" min="0" max={Number(duree) || 120} value={differe} onChange={(event) => setDiffere(event.target.value)} /></div>
        </div>}
        <label htmlFor="decisionCommentaire">Motivation, conditions ou réserves du comité</label>
        <textarea id="decisionCommentaire" required={decision !== 'APPROUVE'} minLength={decision === 'APPROUVE' ? undefined : 3} value={commentaire} onChange={(event) => setCommentaire(event.target.value)} placeholder="Motivation, conditions ou réserves du comité" />
        <label className={committee.confirmation} htmlFor="confirmationDecision"><input id="confirmationDecision" type="checkbox" required checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />Je confirme avoir relu le dossier et souhaite enregistrer cette décision irréversible dans le journal d’audit.</label>
        <Button type="submit" loading={submitting}>Confirmer et enregistrer la décision</Button>
      </form> : <p className={portal.lead}>Ce dossier a déjà quitté la file décisionnelle. La synthèse reste disponible en lecture et à l’impression.</p>}
    </section>
  </main>;
}
