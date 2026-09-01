'use client';

import Link from 'next/link';
import { FormEvent, use, useCallback, useEffect, useState } from 'react';
import portal from '../../../entrepreneur/portal.module.css';
import styles from '../../../agent/agent.module.css';

type Dossier = {
  id: string; numeroDossier: string; statut: string; raisonSociale: string; programmeNom?: string;
  montantDemande: number | string; apportPersonnel: number | string; objetFinancement: string; descriptionProjet?: string;
  nombreEmploisPrevus: number; score: null | { scoreTotal: number | string; niveauRisque: string; recommandation: string; modeleNom: string; modeleVersion: number; criteres: Array<{ code: string; libelle: string; scoreObtenu: number | string; scoreMax: number | string; contribution: number | string; commentaire?: string }> };
  documents: Array<{ id: string; typeDocument: string; nomFichier: string; statutVerification: string }>;
  decisions: Array<{ decision: string; montantApprouve?: number | string; commentaire?: string; dateDecision: string }>;
};

export default function CommitteeApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [decision, setDecision] = useState('APPROUVE');
  const [montant, setMontant] = useState('');
  const [duree, setDuree] = useState('36');
  const [taux, setTaux] = useState('');
  const [differe, setDiffere] = useState('0');
  const [commentaire, setCommentaire] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    const response = await fetch(`/api/comite/dossiers/${id}`, { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body?.message ?? 'Chargement impossible');
    setDossier(body); setMontant(String(body.montantDemande ?? ''));
  }, [id]);
  useEffect(() => { load().catch((error) => setMessage(error.message)); }, [load]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage('');
    const payload = decision === 'APPROUVE'
      ? { decision, montantApprouve: Number(montant), dureeMois: Number(duree), tauxInteret: taux ? Number(taux) : undefined, differeMois: Number(differe), commentaire }
      : { decision, commentaire };
    const response = await fetch(`/api/comite/dossiers/${id}/decision`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await response.json();
    if (!response.ok) return setMessage(body?.message ?? 'Décision impossible');
    setDossier(body); setMessage('Décision du comité enregistrée et auditée.');
  }
  if (!dossier) return <main className={portal.main}><h1 className={portal.title}>Comité</h1><p className={portal.lead}>{message || 'Chargement…'}</p></main>;
  return <main className={portal.main}>
    <p className={portal.eyebrow}>Dossier décisionnel</p><h1 className={portal.title}>{dossier.numeroDossier}</h1><p className={portal.lead}>{dossier.raisonSociale} · <span className={portal.pill}>{dossier.statut}</span></p>
    <div className={portal.buttonRow}><Link className={portal.secondary} href="/comite/dossiers">Retour à la séance</Link></div>
    {message && <div className={`${portal.notice} ${portal.section}`}>{message}</div>}
    <div className={styles.detailGrid}>
      <section className={`${portal.card} ${styles.panel}`}><h2>Projet soumis</h2><div className={styles.facts}><div className={styles.fact}><span>Montant demandé</span><strong>{Number(dossier.montantDemande).toLocaleString('fr-FR')} GNF</strong></div><div className={styles.fact}><span>Apport</span><strong>{Number(dossier.apportPersonnel).toLocaleString('fr-FR')} GNF</strong></div><div className={styles.fact}><span>Programme</span><strong>{dossier.programmeNom ?? '—'}</strong></div><div className={styles.fact}><span>Emplois prévus</span><strong>{dossier.nombreEmploisPrevus}</strong></div></div><h3>{dossier.objetFinancement}</h3><p className={portal.lead}>{dossier.descriptionProjet ?? '—'}</p></section>
      <section className={`${portal.card} ${styles.panel}`}><h2>Score d’aide à la décision</h2>{dossier.score ? <><div className={styles.facts}><div className={styles.fact}><span>Score</span><strong>{dossier.score.scoreTotal}/100</strong></div><div className={styles.fact}><span>Risque</span><strong>{dossier.score.niveauRisque}</strong></div><div className={styles.fact}><span>Recommandation</span><strong>{dossier.score.recommandation}</strong></div><div className={styles.fact}><span>Modèle</span><strong>v{dossier.score.modeleVersion}</strong></div></div><p className={portal.lead}>Le comité reste seul responsable de la décision finale.</p></> : <p className={portal.lead}>Aucun score disponible.</p>}</section>
    </div>
    {dossier.score && <section className={`${portal.card} ${portal.tableCard} ${portal.section}`}><table className={portal.table}><thead><tr><th>Critère</th><th>Note</th><th>Contribution</th><th>Justification</th></tr></thead><tbody>{dossier.score.criteres.map((item) => <tr key={item.code}><td>{item.libelle}</td><td>{item.scoreObtenu}/{item.scoreMax}</td><td>{Number(item.contribution).toFixed(2)}</td><td>{item.commentaire || '—'}</td></tr>)}</tbody></table></section>}
    <section className={`${portal.card} ${portal.formCard} ${portal.section}`}><h2>Décision humaine</h2>{dossier.statut === 'PRET_COMITE' ? <form className={`${styles.review} ${portal.section}`} onSubmit={submit}><select value={decision} onChange={(event) => setDecision(event.target.value)}><option value="APPROUVE">Approuver</option><option value="COMPLEMENT_REQUIS">Demander un complément</option><option value="REJETE">Rejeter</option></select>{decision === 'APPROUVE' && <div className={portal.formGrid}><div className={portal.field}><label>Montant approuvé (GNF)</label><input type="number" min="1" max={Number(dossier.montantDemande)} required value={montant} onChange={(event) => setMontant(event.target.value)} /></div><div className={portal.field}><label>Durée (mois)</label><input type="number" min="1" max="120" required value={duree} onChange={(event) => setDuree(event.target.value)} /></div><div className={portal.field}><label>Taux d’intérêt (%)</label><input type="number" min="0" max="100" step="0.0001" value={taux} onChange={(event) => setTaux(event.target.value)} /></div><div className={portal.field}><label>Différé (mois)</label><input type="number" min="0" max={Number(duree) || 120} value={differe} onChange={(event) => setDiffere(event.target.value)} /></div></div>}<textarea required={decision !== 'APPROUVE'} minLength={decision === 'APPROUVE' ? undefined : 3} value={commentaire} onChange={(event) => setCommentaire(event.target.value)} placeholder="Motivation, conditions ou réserves du comité" /><button className={portal.primary}>Enregistrer la décision</button></form> : <p className={portal.lead}>Ce dossier a déjà quitté la file décisionnelle.</p>}</section>
  </main>;
}
