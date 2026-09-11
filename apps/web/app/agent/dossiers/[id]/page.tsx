'use client';

import { FormEvent, use, useCallback, useEffect, useState } from 'react';
import Button from '../../../_shared/Button';
import ConfirmDialog from '../../../_shared/ConfirmDialog';
import Skeleton from '../../../_shared/Skeleton';
import { DossierStatusBadge, GenericStatusBadge, RiskBadge } from '../../../_shared/StatusBadge';
import portal from '../../../entrepreneur/portal.module.css';
import workspace from '../../InstructionWorkspace.module.css';

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
  const [pendingReview, setPendingReview] = useState(false);
  const [online, setOnline] = useState(true);

  const load = useCallback(async () => {
    const [dossierResponse, scoringResponse] = await Promise.all([
      fetch(`/api/agent/dossiers/${id}`, { cache: 'no-store' }),
      fetch(`/api/agent/scoring/${id}`, { cache: 'no-store' }),
    ]);
    const [body, scoringBody] = await Promise.all([dossierResponse.json(), scoringResponse.json()]);
    if (!dossierResponse.ok) throw new Error(body?.message ?? 'Chargement impossible');
    if (!scoringResponse.ok) throw new Error(scoringBody?.message ?? 'Chargement du scoring impossible');
    setDossier(body);
    setScoring(scoringBody);
    const previous = new Map<string, { scoreObtenu: number | string; commentaire?: string }>((scoringBody.score?.criteres ?? []).map((item: { code: string; scoreObtenu: number | string; commentaire?: string }) => [item.code, item]));
    setScoreAnswers(Object.fromEntries(scoringBody.modele.criteres.map((criterion: { code: string }) => {
      const saved = previous.get(criterion.code);
      return [criterion.code, { scoreObtenu: saved ? String(saved.scoreObtenu) : '', commentaire: saved?.commentaire ?? '' }];
    })));
  }, [id]);

  useEffect(() => { load().catch((error) => setMessage(error.message)); }, [load]);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => { window.removeEventListener('online', sync); window.removeEventListener('offline', sync); };
  }, []);

  async function claim() {
    if (!online) return setMessage('Connexion requise pour prendre en charge un dossier.');
    setMessage('');
    const response = await fetch(`/api/agent/dossiers/${id}/claim`, { method: 'POST' });
    const body = await response.json();
    if (!response.ok) return setMessage(body?.message ?? 'Prise en charge impossible');
    setDossier(body);
    setMessage('Dossier pris en charge.');
  }

  function review(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    if (!online) return setMessage('Connexion requise pour enregistrer une décision d’instruction.');
    setPendingReview(true);
  }

  async function confirmReview() {
    setPendingReview(false);
    const response = await fetch(`/api/agent/dossiers/${id}/review`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ statut, commentaire }),
    });
    const body = await response.json();
    if (!response.ok) return setMessage(body?.message ?? 'Mise à jour impossible');
    setDossier(body);
    setCommentaire('');
    setMessage('Décision d’instruction enregistrée.');
  }

  async function verify(documentId: string, verificationStatus: string, commentaireVerification = '') {
    if (!online) return setMessage('Connexion requise pour vérifier une pièce.');
    const previous = dossier;
    setDossier((current) => current ? {
      ...current,
      documents: current.documents.map((document) => document.id === documentId
        ? { ...document, statutVerification: verificationStatus, verificationComment: commentaireVerification || document.verificationComment }
        : document),
    } : current);
    setMessage('Mise à jour de la pièce…');

    try {
      const response = await fetch(`/api/agent/documents/${documentId}/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ statut: verificationStatus, commentaire: commentaireVerification || undefined }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message ?? 'Vérification impossible');
      setMessage('Document vérifié.');
      await load();
    } catch (error) {
      setDossier(previous);
      setMessage(error instanceof Error ? error.message : 'Vérification impossible');
    }
  }

  async function saveScore(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    if (!online) return setMessage('Connexion requise pour enregistrer le scoring.');
    if (!scoring) return;
    const criteres = scoring.modele.criteres.map((criterion) => ({
      code: criterion.code,
      scoreObtenu: Number(scoreAnswers[criterion.code]?.scoreObtenu),
      commentaire: scoreAnswers[criterion.code]?.commentaire || undefined,
    }));
    const response = await fetch(`/api/agent/scoring/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ criteres }) });
    const body = await response.json();
    if (!response.ok) return setMessage(body?.message ?? 'Calcul du score impossible');
    setScoring({ ...scoring, score: body });
    setMessage('Scoring calculé et enregistré.');
  }

  if (!dossier) {
    return <main className={portal.main}><p className={portal.eyebrow}>Fiche dossier 360°</p><h1 className={portal.title}>Instruction du dossier</h1>{message ? <div className={portal.notice} role="alert">{message}</div> : <Skeleton lines={5} />}</main>;
  }

  const validatedDocuments = dossier.documents.filter((document) => document.statutVerification === 'VALIDE').length;
  const canInstruct = Boolean(dossier.agentResponsableId);

  return <main className={portal.main}>
    <header className={workspace.header}>
      <div className={workspace.headerMain}>
        <p className={portal.eyebrow}>Poste d’instruction</p>
        <h1 className={portal.title}>{dossier.numeroDossier}</h1>
        <div className={workspace.headerStatus}>
          <strong>{dossier.raisonSociale}</strong>
          <DossierStatusBadge status={dossier.statut} />
          <span className={workspace.technicalStatus}>{dossier.statut}</span>
        </div>
      </div>
      <div className={workspace.headerActions}>
        <Button variant="outline" href="/agent/dossiers">Retour à la file</Button>
        {!dossier.agentResponsableId ? <Button type="button" onClick={claim} disabled={!online}>Prendre en charge</Button> : null}
      </div>
    </header>

    {message ? <div className={`${portal.notice} ${workspace.message}`} role="status">{message}</div> : null}

    <section className={workspace.summaryStrip} aria-label="Synthèse du dossier">
      <div><span>Programme</span><strong>{dossier.programmeNom ?? '—'}</strong></div>
      <div><span>Montant demandé</span><strong>{Number(dossier.montantDemande).toLocaleString('fr-FR')} GNF</strong></div>
      <div><span>Apport</span><strong>{Number(dossier.apportPersonnel).toLocaleString('fr-FR')} GNF</strong></div>
      <div><span>Pièces validées</span><strong>{validatedDocuments}/{dossier.documents.length}</strong></div>
    </section>

    <div className={workspace.workspace}>
      <div className={workspace.mainColumn}>
        <section className={workspace.panel} aria-labelledby="project-title">
          <div className={workspace.panelHeader}><div><h2 id="project-title">Entreprise et projet</h2><p>Les informations nécessaires à l’analyse, sans changer d’écran.</p></div></div>
          <div className={workspace.factGrid}>
            <div className={workspace.fact}><span>PME</span><strong>{dossier.raisonSociale}</strong></div>
            <div className={workspace.fact}><span>Code FODIP</span><strong>{dossier.codeFodip}</strong></div>
            <div className={workspace.fact}><span>RCCM</span><strong>{dossier.rccm ?? '—'}</strong></div>
            <div className={workspace.fact}><span>NIF</span><strong>{dossier.nif ?? '—'}</strong></div>
            <div className={workspace.fact}><span>Emplois actuels</span><strong>{dossier.nombreEmployes}</strong></div>
            <div className={workspace.fact}><span>Emplois prévus</span><strong>{dossier.nombreEmploisPrevus}</strong></div>
          </div>
          <h3>{dossier.objetFinancement}</h3>
          <p className={workspace.projectText}>{dossier.descriptionProjet ?? 'Aucune description du projet.'}</p>
        </section>

        <section className={workspace.panel} aria-labelledby="documents-title">
          <div className={workspace.panelHeader}>
            <div><h2 id="documents-title">Pièces justificatives</h2><p>Consultez et qualifiez les documents sans quitter l’instruction.</p></div>
            <span className={portal.pillMuted}>{validatedDocuments}/{dossier.documents.length} validées</span>
          </div>
          <div className={workspace.documentList}>
            {dossier.documents.map((document) => (
              <article className={workspace.documentRow} key={document.id}>
                <div className={workspace.documentInfo}>
                  <strong>{document.typeDocument}</strong>
                  <span title={document.nomFichier}>{document.nomFichier}</span>
                </div>
                <div className={workspace.documentActions}>
                  <GenericStatusBadge status={document.statutVerification} />
                  <Button variant="outline" href={`/api/agent/documents/${document.id}/download`}>Ouvrir</Button>
                  <Button type="button" onClick={() => verify(document.id, 'VALIDE')} disabled={!online}>Valider</Button>
                  <Button variant="outline" type="button" onClick={() => setPendingVerification(document.id)} disabled={!online}>Complément</Button>
                </div>
              </article>
            ))}
            {dossier.documents.length === 0 ? <p className={portal.lead}>Aucun document déposé.</p> : null}
          </div>
        </section>

        <section className={workspace.panel} aria-labelledby="history-title">
          <div className={workspace.panelHeader}><div><h2 id="history-title">Journal d’instruction</h2><p>Chaque changement reste horodaté et lisible pour l’audit.</p></div></div>
          <div className={workspace.history}>
            {dossier.historique.map((item, index) => (
              <div className={workspace.historyItem} key={`${item.changedAt}-${index}`}>
                <strong>{item.ancienStatut ?? 'CRÉATION'} → {item.nouveauStatut}</strong>
                <span>{item.commentaire ?? 'Sans commentaire'} · {new Date(item.changedAt).toLocaleString('fr-FR')}</span>
              </div>
            ))}
            {dossier.historique.length === 0 ? <p className={portal.lead}>Aucun changement de statut enregistré.</p> : null}
          </div>
        </section>
      </div>

      <aside className={workspace.rail} aria-label="Outils d’instruction">
        {scoring ? <section className={workspace.panel} aria-labelledby="scoring-title">
          <div className={workspace.panelHeader}><div><h2 id="scoring-title">Scoring explicable</h2><p>{scoring.modele.nom} · version {scoring.modele.version}</p></div></div>
          {scoring.score ? <div className={workspace.scoreSummary}><strong>{scoring.score.scoreTotal}/100 · {scoring.score.niveauRisque}</strong><RiskBadge level={scoring.score.niveauRisque} /></div> : null}
          <form className={workspace.scoreForm} onSubmit={saveScore}>
            {scoring.modele.criteres.map((criterion) => (
              <div className={workspace.scoreCriterion} key={criterion.code}>
                <div className={workspace.scoreCriterionMeta}><strong>{criterion.libelle}</strong><span>Poids {criterion.poids}% · max {criterion.scoreMax}</span></div>
                <input type="number" min="0" max={Number(criterion.scoreMax)} step="0.01" required aria-label={`Note pour ${criterion.libelle}`} value={scoreAnswers[criterion.code]?.scoreObtenu ?? ''} onChange={(event) => setScoreAnswers((current) => ({ ...current, [criterion.code]: { scoreObtenu: event.target.value, commentaire: current[criterion.code]?.commentaire ?? '' } }))} />
                <textarea maxLength={1000} aria-label={`Justification pour ${criterion.libelle}`} value={scoreAnswers[criterion.code]?.commentaire ?? ''} onChange={(event) => setScoreAnswers((current) => ({ ...current, [criterion.code]: { scoreObtenu: current[criterion.code]?.scoreObtenu ?? '', commentaire: event.target.value } }))} placeholder="Justification de la note" />
              </div>
            ))}
            <Button type="submit" disabled={dossier.statut !== 'EN_INSTRUCTION' || !canInstruct || !online}>Calculer et enregistrer</Button>
          </form>
          <p className={portal.lead}>Le score est une aide structurée. Il ne prend aucune décision à la place du comité.</p>
        </section> : null}

        <section className={workspace.panel} aria-labelledby="decision-title">
          <div className={workspace.panelHeader}><div><h2 id="decision-title">Décision d’instruction</h2><p>Action sensible : confirmation et traçabilité obligatoires.</p></div></div>
          <form className={workspace.reviewForm} onSubmit={review}>
            <label htmlFor="reviewStatut">Décision d'instruction</label>
            <select id="reviewStatut" value={statut} onChange={(event) => setStatut(event.target.value)}>
              <option value="EN_INSTRUCTION">Poursuivre l’instruction</option>
              <option value="COMPLEMENT_REQUIS">Demander un complément</option>
              <option value="PRET_COMITE">Transmettre au comité</option>
            </select>
            <label htmlFor="reviewCommentaire">Motivation de la décision</label>
            <textarea id="reviewCommentaire" required minLength={3} value={commentaire} onChange={(event) => setCommentaire(event.target.value)} placeholder="Motivation factuelle et traçable" />
            <Button type="submit" disabled={!canInstruct || !online}>Enregistrer</Button>
          </form>
        </section>
      </aside>
    </div>

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
    <ConfirmDialog
      open={pendingReview}
      title="Confirmer la décision d’instruction"
      message={`Vous allez enregistrer « ${statut} » sur ${dossier.numeroDossier}. Cette action sera horodatée dans l’historique.`}
      confirmLabel="Confirmer la décision"
      onConfirm={() => void confirmReview()}
      onCancel={() => setPendingReview(false)}
    />
  </main>;
}
