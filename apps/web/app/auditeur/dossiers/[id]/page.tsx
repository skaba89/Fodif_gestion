'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Breadcrumbs from '../../../_shared/Breadcrumbs';
import Button from '../../../_shared/Button';
import Skeleton from '../../../_shared/Skeleton';
import { DossierStatusBadge, GenericStatusBadge, RiskBadge } from '../../../_shared/StatusBadge';
import { humanizeCode } from '../../../_shared/displayLabels';
import { dossierStatusLabel } from '../../../_shared/dossierStatus';
import portal from '../../../entrepreneur/portal.module.css';
import workspace from '../../../agent/InstructionWorkspace.module.css';

type Document = { id: string; typeDocument: string; nomFichier: string; statutVerification: string };
type History = { ancienStatut?: string; nouveauStatut: string; commentaire?: string; changedAt: string };
type Score = { scoreTotal?: string; niveauRisque?: string; recommandation?: string };
type AuditEntry = { id: string; action: string; entityType: string; createdAt: string; actorEmail?: string | null; actorNom?: string | null; actorPrenom?: string | null };
type Dossier = {
  id: string; numeroDossier: string; statut: string;
  raisonSociale: string; codeFodip: string; rccm?: string; nif?: string;
  programmeNom?: string; montantDemande: string | number; apportPersonnel: string | number; objetFinancement: string;
  descriptionProjet?: string; nombreEmploisPrevus: number; nombreEmployes: number;
  documents: Document[]; historique: History[]; scores: Score[]; auditTrail: AuditEntry[];
};

function actorLabel(entry: AuditEntry): string {
  const fullName = [entry.actorPrenom, entry.actorNom].filter(Boolean).join(' ').trim();
  if (fullName && entry.actorEmail) return `${fullName} · ${entry.actorEmail}`;
  return fullName || entry.actorEmail || 'Système';
}

/**
 * Read-only "drill-down dossier" for AUDITEUR (issue #142). Same detail shape as the Agent
 * instruction workspace (GET /audit/dossiers/:id, backed by AgentApplicationsRepository.findById
 * without the agent-ownership check — see AuditService#dossier) plus a chronological audit trail
 * for the dossier and the financement it produced, never a form: AUDITEUR has no write action.
 */
export default function AuditeurDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const response = await fetch(`/api/auditeur/dossiers/${id}`, { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body?.message ?? 'Chargement impossible');
    setDossier(body);
  }, [id]);

  useEffect(() => { load().catch((error) => setMessage(error.message)); }, [load]);

  if (!dossier) {
    return <main className={portal.main}><p className={portal.eyebrow}>Fiche dossier 360°</p><h1 className={portal.title}>Dossier audité</h1>{message ? <div className={portal.notice} role="alert">{message}</div> : <Skeleton lines={5} />}</main>;
  }

  const validatedDocuments = dossier.documents.filter((document) => document.statutVerification === 'VALIDE').length;
  const score = dossier.scores[0];

  return <main className={portal.main}>
    <Breadcrumbs items={[{ label: 'Auditeur', href: '/auditeur/tableau-de-bord' }, { label: dossier.numeroDossier }]} />
    <header className={workspace.header}>
      <div className={workspace.headerMain}>
        <p className={portal.eyebrow}>Contrôle indépendant</p>
        <h1 className={portal.title}>{dossier.numeroDossier}</h1>
        <div className={workspace.headerStatus}>
          <strong>{dossier.raisonSociale}</strong>
          <DossierStatusBadge status={dossier.statut} />
        </div>
      </div>
      <div className={workspace.headerActions}>
        <Button variant="outline" href="/auditeur/tableau-de-bord">Retour à la supervision</Button>
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
          <div className={workspace.panelHeader}><div><h2 id="project-title">Entreprise et projet</h2></div></div>
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
            <div><h2 id="documents-title">Pièces justificatives</h2></div>
            <span className={portal.pillMuted}>{validatedDocuments}/{dossier.documents.length} validées</span>
          </div>
          <div className={workspace.documentList}>
            {dossier.documents.map((document) => (
              <article className={workspace.documentRow} key={document.id}>
                <div className={workspace.documentInfo}>
                  <strong>{humanizeCode(document.typeDocument)}</strong>
                  <span title={document.nomFichier}>{document.nomFichier}</span>
                </div>
                <GenericStatusBadge status={document.statutVerification} />
              </article>
            ))}
            {dossier.documents.length === 0 ? <p className={portal.lead}>Aucun document déposé.</p> : null}
          </div>
        </section>

        <section className={workspace.panel} aria-labelledby="history-title">
          <div className={workspace.panelHeader}><div><h2 id="history-title">Journal d’instruction</h2></div></div>
          <div className={workspace.history}>
            {dossier.historique.map((item, index) => (
              <div className={workspace.historyItem} key={`${item.changedAt}-${index}`}>
                <strong title={item.ancienStatut ? `${item.ancienStatut} → ${item.nouveauStatut}` : item.nouveauStatut}>{item.ancienStatut ? dossierStatusLabel(item.ancienStatut) : 'Création'} → {dossierStatusLabel(item.nouveauStatut)}</strong>
                <span>{item.commentaire ?? 'Sans commentaire'} · {new Date(item.changedAt).toLocaleString('fr-FR')}</span>
              </div>
            ))}
            {dossier.historique.length === 0 ? <p className={portal.lead}>Aucun changement de statut enregistré.</p> : null}
          </div>
        </section>

        <section className={workspace.panel} aria-labelledby="audit-title">
          <div className={workspace.panelHeader}><div><h2 id="audit-title">Preuve chronologique</h2><p>Journal d’audit du dossier et du financement qui en découle, toutes actions confondues.</p></div></div>
          <div className={workspace.history}>
            {dossier.auditTrail.map((entry) => (
              <div className={workspace.historyItem} key={entry.id}>
                <strong>{humanizeCode(entry.action)}</strong>
                <span>{actorLabel(entry)} · {new Date(entry.createdAt).toLocaleString('fr-FR')}</span>
              </div>
            ))}
            {dossier.auditTrail.length === 0 ? <p className={portal.lead}>Aucune opération auditée pour ce dossier.</p> : null}
          </div>
        </section>
      </div>

      <aside className={workspace.rail} aria-label="Synthèse d’évaluation">
        {score ? <section className={workspace.panel} aria-labelledby="scoring-title">
          <div className={workspace.panelHeader}><div><h2 id="scoring-title">Scoring explicable</h2></div></div>
          <div className={workspace.scoreSummary}><strong>{score.scoreTotal ?? '—'}/100 · {score.niveauRisque ?? '—'}</strong>{score.niveauRisque ? <RiskBadge level={score.niveauRisque} /> : null}</div>
          <p className={portal.lead}>{score.recommandation ?? 'Aucune recommandation enregistrée.'}</p>
        </section> : null}
      </aside>
    </div>
  </main>;
}
