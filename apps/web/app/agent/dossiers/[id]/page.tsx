'use client';

import Link from 'next/link';
import { FormEvent, use, useCallback, useEffect, useState } from 'react';
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

export default function AgentDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [statut, setStatut] = useState('COMPLEMENT_REQUIS');
  const [commentaire, setCommentaire] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const response = await fetch(`/api/agent/dossiers/${id}`, { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body?.message ?? 'Chargement impossible');
    setDossier(body);
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
  async function verify(documentId: string, verificationStatus: string) {
    const commentaireVerification = verificationStatus === 'VALIDE' ? '' : window.prompt('Commentaire obligatoire :') ?? '';
    if (verificationStatus !== 'VALIDE' && !commentaireVerification.trim()) return;
    const response = await fetch(`/api/agent/documents/${documentId}/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ statut: verificationStatus, commentaire: commentaireVerification || undefined }) });
    const body = await response.json();
    if (!response.ok) return setMessage(body?.message ?? 'Vérification impossible');
    setMessage('Document vérifié.'); await load();
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
      <section className={`${portal.card} ${styles.panel}`}><h2>Instruction</h2><form className={styles.review} onSubmit={review}><select value={statut} onChange={(event) => setStatut(event.target.value)}><option value="EN_INSTRUCTION">Poursuivre l’instruction</option><option value="COMPLEMENT_REQUIS">Demander un complément</option><option value="PRET_COMITE">Transmettre au comité</option></select><textarea required minLength={3} value={commentaire} onChange={(event) => setCommentaire(event.target.value)} placeholder="Motivation de la décision" /><button className={portal.primary} disabled={!dossier.agentResponsableId}>Enregistrer</button></form></section>
    </div>
    <section className={`${portal.card} ${portal.tableCard} ${portal.section}`}><div className={styles.panel}><h2>Documents</h2></div><table className={portal.table}><thead><tr><th>Type</th><th>Fichier</th><th>Statut</th><th>Actions</th></tr></thead><tbody>{dossier.documents.map((document) => <tr key={document.id}><td>{document.typeDocument}</td><td>{document.nomFichier}</td><td><span className={portal.pill}>{document.statutVerification}</span></td><td><div className={portal.buttonRow}><a className={portal.secondary} href={`/api/agent/documents/${document.id}/download`}>Télécharger</a><button className={portal.primary} type="button" onClick={() => verify(document.id, 'VALIDE')}>Valider</button><button className={portal.secondary} type="button" onClick={() => verify(document.id, 'A_COMPLETER')}>Complément</button></div></td></tr>)}</tbody></table>{dossier.documents.length === 0 && <p className={portal.lead}>Aucun document déposé.</p>}</section>
    <section className={`${portal.card} ${styles.panel} ${portal.section}`}><h2>Historique</h2><div className={styles.history}>{dossier.historique.map((item, index) => <div className={styles.historyItem} key={`${item.changedAt}-${index}`}><strong>{item.ancienStatut ?? 'CRÉATION'} → {item.nouveauStatut}</strong><span>{item.commentaire ?? 'Sans commentaire'} · {new Date(item.changedAt).toLocaleString('fr-FR')}</span></div>)}{dossier.historique.length === 0 && <p className={portal.lead}>Aucun changement de statut enregistré.</p>}</div></section>
  </main>;
}
