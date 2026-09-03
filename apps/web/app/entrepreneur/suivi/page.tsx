'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { clientApi } from '../../../lib/client-api';
import styles from '../portal.module.css';
type Application = { id: string; numeroDossier: string; programmeNom?: string; montantDemande: string | number; dateSoumission?: string; statut: string; createdAt: string };
export default function TrackingPage() {
  const [dossiers, setDossiers] = useState<Application[]>([]); const [message, setMessage] = useState('');
  async function load() { try { setDossiers(await clientApi<Application[]>('/api/pme/dossiers')); } catch (e) { setMessage(e instanceof Error ? e.message : 'Chargement impossible'); } }
  useEffect(() => { load(); }, []);
  async function submit(id: string) { setMessage(''); try { await clientApi(`/api/pme/dossiers/${id}/submit`, { method: 'POST' }); setMessage('Dossier soumis avec succès.'); await load(); } catch (e) { setMessage(e instanceof Error ? e.message : 'Soumission impossible'); } }
  return <main className={styles.main}><p className={styles.eyebrow}>Mes dossiers</p><h1 className={styles.title}>Suivi de mes demandes</h1><p className={styles.lead}>Cette liste est filtrée côté backend sur l’entreprise portée par votre session.</p>{message && <div className={styles.notice}>{message}</div>}<section className={`${styles.card} ${styles.tableCard} ${styles.section}`} tabIndex={0} role="region" aria-label="Tableau, défilement horizontal sur petit écran"><table className={styles.table}><thead><tr><th>Dossier</th><th>Programme</th><th>Montant</th><th>Date</th><th>Statut</th><th>Actions</th></tr></thead><tbody>{dossiers.map((d) => <tr key={d.id}><td><strong>{d.numeroDossier}</strong></td><td>{d.programmeNom ?? '—'}</td><td>{Number(d.montantDemande).toLocaleString('fr-FR')} GNF</td><td>{new Date(d.dateSoumission ?? d.createdAt).toLocaleDateString('fr-FR')}</td><td><span className={styles.pill}>{d.statut}</span></td><td><div className={styles.buttonRow}><Link className={styles.secondary} href={`/entrepreneur/suivi/${d.id}/documents`}>Documents</Link>{d.statut === 'BROUILLON' && <button className={styles.primary} type="button" onClick={() => submit(d.id)}>Soumettre</button>}</div></td></tr>)}</tbody></table>{dossiers.length === 0 && <p className={styles.lead}>Aucun dossier pour le moment.</p>}</section></main>;
}
