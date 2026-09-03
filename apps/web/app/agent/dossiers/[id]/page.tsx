'use client';

import Link from 'next/link';
import { FormEvent, use, useCallback, useEffect, useState } from 'react';
import ConfirmDialog from '../../../_shared/ConfirmDialog';
import portal from '../../../entrepreneur/portal.module.css';
import styles from '../../agent.module.css';

type Document = { id: string; typeDocument: string; nomFichier: string; statutVerification: string; verificationComment?: string };
type History = { ancienStatut?: string; nouveauStatut: string; commentaire?: string; changedAt: string };
type Dossier = {
  id: string; numeroDossier: string; statut: string; agentResponsableId?: string | null;
  raisonSociale: string; codeFodip: string; rccm?: string; nif?: string; telephone?: string; email?: string;
  programmeNom?: string; montantDemande: string | number; apportPersonnel: string | number; objetFinancement: string;
  descriptionProjet?: string; nombreEmploisPrevus: number; nombreEmployes: number; chiffreAffairesAnnuel?: string | number;
  dirigeants: Array<{ id: string; nom: string; prenom?: string; fonction?: string }>;
  documents: Document[]; historique: History[]; scores: Array<{ scoreTotal?: string; niveauRisque?: string; recommandation?: string }>;
};
type ScoringContext = {
  modele: { id: string; nom: string; version: number; criteres: Array<{ code: string; libelle: string; categorie?: string; poids: number | string; scoreMax: number | string }> };
  score: null | { scoreTotal: number | string; niveauRisque: string; recommandation: string; criteres: Array<{ code: string; scoreObtenu: number | string; commentaire?: string }> };
};

export default function AgentDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [statut, setStatut] = useState('COMPLEMENT_REQUIS');
  const [commentaire, setCommentaire] = useState('');
  const [message, setMessage] = useState('');
  const [scoring, setScoring] = useState<ScoringContext | null>(null);
  const [scoreAnswers, setScoreAnswers] = useState<Record<string, { scoreObtenu: string; commentaire: string }>>({});
  const [pendingVerification, setPendingVerification] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [dossierResponse, scoringResponse] = await Promise.all([
      fetch(`/api/agent/dossiers/${id}`, { cache: 'no-store' }),
      fetch(`/api/agent/scoring/${id}`, { cache: 'no-store' }),
    ]);
    const [body, scoringBody] = await Promise.all([dossierResponse.json(), scoringResponse.json()]);
    if (!dossierResponse.ok) throw new Error(body?.message ?? 'Chargement impossible');
    if (!scoringResponse.ok) throw new Error(scoringBody?.message ?? 'Chargement du scoring impossible');
    setDossier(body); setScoring(scoringBody);
    const previous = new Map<string, { scoreObtenu: number | string; commentaire?: string }>((scoringBody.score?.criteres ?? []).map((item: { code: string; scoreObtenu: number | string; commentaire?: string }) => [item.code, item]));
    setScoreAnswers(Object.fromEntries(scoringBody.modele.criteres.map((criterion: { code: string }) => {
      const saved = previous.get(criterion.code);
      return [criterion.code, { scoreObtenu: saved ? String(saved.scoreObtenu) : '', commentaire: saved?.commentaire ?? '' }];
    })));
  }, [id]);
  useEffect(() => { load().catch((error) => setMessage(error.message)); }, [load]);

  async function claim() {
    setMessage('');
    const response = await fetch(`/api/agent/dossiers/${id}/claim`, { method: 'POST' });
    const body = await response.json();
    if (!response.ok) return setMessage(body?.message ?? 'Prise en charge impossible');
    setDossier(body); setMessage('Dossier pris en charge.');
  }
  async function review(event: FormEvent) {
    event.preventDefault(); setMessage('');
    const response = await fetch(`/api/agent/dossiers/${id}/review`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ statut, commentaire }) });
    const body = await response.json();
    if (!response.ok) return setMessage(body?.message ?? 'Mise à jour impossible');
    setDossier(body); setCommentaire(''); setMessage('Décision d’instruction enregistrée.');
  }
  async function verify(documentId: string, verificationStatus: string, commentaireVerification = '') {
    const response = await fetch(`/api/agent/documents/${documentId}/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ statut: verificationStatus, commentaire: commentaireVerification || undefined }) });
    const body = await response.json();
    if (!response.ok) return setMessage(body?.message ?? 'Vérification impossible');
    setMessage('Document vérifié.'); await load();
  }
  async function saveScore(event: FormEvent) {
    event.preventDefault(); setMessage('');
    if (!scoring) return;
    const criteres = scoring.modele.criteres.map((criterion) => ({
      code: criterion.code,
      scoreObtenu: Number(scoreAnswers[criterion.code]?.scoreObtenu),
      commentaire: scoreAnswers[criterion.code]?.commentaire || undefined,
    }));
    const response = await fetch(`/api/agent/scoring/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ criteres }) });
    const body = await response.json();
    if (!response.ok) return setMessage(body?.message ?? 'Calcul du score impossible');
    setScoring({ ...scoring, score: body }); setMessage('Scoring calculé et enregistré.');
  }

  if (!dossier) return <main className={portal.main}><h1 className={portal.title}>Dossier</h1><p className={portal.lead}>{message || 'Chargement…'}</p></main>;
  return <main className={portal.main}>
    <p className={portal.eyebrow}>Fiche dossier 360°</p><h1 className={portal.title}>{dossier.numeroDossier}</h1>
    <p className={portal.lead}>{dossier.raisonSociale} · <span className={portal.pill}>{dossier.statut}</span></p>
    <div className={portal.buttonRow}><Link className={portal.secondary} href="/agent/dossiers">Retour</Link>{!dossier.agentResponsableId && <button className={portal.primary} type="button" onClick={claim}>Prendre en charge</button>}</div>
    {message && <div className={portal.notice}>{message}</div>}
    <div className={styles.detailGrid}>
      <section className={`${portal.card} ${styles.panel}`}><h2>Entreprise et projet</h2><div className={styles.facts}>
        <div className={styles.fact}><span>PME</span><strong>{dossier.raisonSociale}</strong></div><div className={styles.fact}><span>Code</span><strong>{dossier.codeFodip}</strong></div>
        <div className={styles.fact}><span>RCCM</span><strong>{dossier.rccm ?? '—'}</strong></div><div className={styles.fact}><span>NIF</span><strong>{dossier.nif ?? '—'}</strong></div>
        <div className={styles.fact}><span>Montant demandé</span><strong>{Number(dossier.montantDemande).toLocaleString('fr-FR')} GNF</strong></div><div className={styles.fact}><span>Apport</span><strong>{Number(dossier.apportPersonnel).toLocaleString('fr-FR')} GNF</strong></div>
        <div className={styles.fact}><span>Programme</span><strong>{dossier.programmeNom ?? '—'}</strong></div><div className={styles.fact}><span>Emplois prévus</span><strong>{dossier.nombreEmploisPrevus}</strong></div>
      </div><h3>{dossier.objetFinancement}</h3><p className={portal.lead}>{dossier.descriptionProjet ?? 'Aucune description.'}</p></section>
      <section className={`${portal.card} ${styles.panel}`}><h2>Instruction</h2><form className={styles.review} onSubmit={review}><label htmlFor="reviewStatut">Décision d'instruction</label><select id="reviewStatut" value={statut} onChange={(event) => setStatut(event.target.value)}><option value="EN_INSTRUCTION">Poursuivre l’instruction</option><option value="COMPLEMENT_REQUIS">Demander un complément</option><option value="PRET_COMITE">Transmettre au comité</option></select><label htmlFor="reviewCommentaire">Motivation de la décision</label><textarea id="reviewCommentaire" required minLength={3} value={commentaire} onChange={(event) => setCommentaire(event.target.value)} placeholder="Motivation de la décision" /><button className={portal.primary} disabled={!dossier.agentResponsableId}>Enregistrer</button></form></section>
    </div>
    {scoring && <section className={`${portal.card} ${styles.panel} ${portal.section}`}><div className={portal.sectionHeader}><div><h2>Scoring explicable</h2><p>{scoring.modele.nom} · version {scoring.modele.version}</p></div>{scoring.score && <span className={portal.pill}>{scoring.score.scoreTotal}/100 · {scoring.score.niveauRisque}</span>}</div><form className={styles.scoreGrid} onSubmit={saveScore}>{scoring.modele.criteres.map((criterion) => <div className={styles.scoreCriterion} key={criterion.code}><div><strong>{criterion.libelle}</strong><span>Poids {criterion.poids}% · maximum {criterion.scoreMax}</span></div><input type="number" min="0" max={Number(criterion.scoreMax)} step="0.01" required aria-label={`Note pour ${criterion.libelle}`} value={scoreAnswers[criterion.code]?.scoreObtenu ?? ''} onChange={(event) => setScoreAnswers((current) => ({ ...current, [criterion.code]: { scoreObtenu: event.target.value, commentaire: current[criterion.code]?.commentaire ?? '' } }))} /><textarea maxLength={1000} aria-label={`Justification pour ${criterion.libelle}`} value={scoreAnswers[criterion.code]?.commentaire ?? ''} onChange={(event) => setScoreAnswers((current) => ({ ...current, [criterion.code]: { scoreObtenu: current[criterion.code]?.scoreObtenu ?? '', commentaire: event.target.value } }))} placeholder="Justification de la note" /></div>)}<div className={portal.buttonRow}><button className={portal.primary} disabled={dossier.statut !== 'EN_INSTRUCTION' || !dossier.agentResponsableId}>Calculer et enregistrer</button></div></form><p className={portal.lead}>Le score est une aide structurée. Il ne prend aucune décision à la place du comité.</p></section>}
    <section className={`${portal.card} ${portal.tableCard} ${portal.section}`} tabIndex={0} role="region" aria-label="Tableau, défilement horizontal sur petit écran"><div className={styles.panel}><h2>Documents</h2></div><table className={portal.table}><thead><tr><th>Type</th><th>Fichier</th><th>Statut</th><th>Actions</th></tr></thead><tbody>{dossier.documents.map((document) => <tr key={document.id}><td>{document.typeDocument}</td><td>{document.nomFichier}</td><td><span className={portal.pill}>{document.statutVerification}</span></td><td><div className={portal.buttonRow}><a className={portal.secondary} href={`/api/agent/documents/${document.id}/download`}>Télécharger</a><button className={portal.primary} type="button" onClick={() => verify(document.id, 'VALIDE')}>Valider</button><button className={portal.secondary} type="button" onClick={() => setPendingVerification(document.id)}>Complément</button></div></td></tr>)}</tbody></table>{dossier.documents.length === 0 && <p className={portal.lead}>Aucun document déposé.</p>}</section>
    <section className={`${portal.card} ${styles.panel} ${portal.section}`}><h2>Historique</h2><div className={styles.history}>{dossier.historique.map((item, index) => <div className={styles.historyItem} key={`${item.changedAt}-${index}`}><strong>{item.ancienStatut ?? 'CRÉATION'} → {item.nouveauStatut}</strong><span>{item.commentaire ?? 'Sans commentaire'} · {new Date(item.changedAt).toLocaleString('fr-FR')}</span></div>)}{dossier.historique.length === 0 && <p className={portal.lead}>Aucun changement de statut enregistré.</p>}</div></section>
    <ConfirmDialog
      open={Boolean(pendingVerification)}
      title="Demander un complément"
      message="Ce document est renvoyé au dépositaire pour complément. Précisez ce qui manque ou doit être corrigé."
      confirmLabel="Envoyer"
      requireComment
      commentLabel="Commentaire obligatoire"
      onConfirm={(comment) => { const documentId = pendingVerification; setPendingVerification(null); if (documentId) void verify(documentId, 'A_COMPLETER', comment); }}
      onCancel={() => setPendingVerification(null)}
    />
  </main>;
}
