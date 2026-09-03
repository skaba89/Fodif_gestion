'use client';

import Link from 'next/link';
import { FormEvent, use, useCallback, useEffect, useState } from 'react';
import styles from '../../../portal.module.css';

type Document = {
  id: string;
  typeDocument: string;
  nomFichier: string;
  tailleOctets: string | number;
  statutVerification: string;
  verificationComment?: string | null;
};

const documentTypes = [
  ['RCCM', 'RCCM'],
  ['NIF', 'NIF'],
  ['BUSINESS_PLAN', 'Business plan'],
  ['ETATS_FINANCIERS', 'États financiers'],
  ['GARANTIE', 'Garantie'],
  ['AUTRE', 'Autre document'],
] as const;

export default function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [typeDocument, setTypeDocument] = useState('RCCM');
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/pme/dossiers/${id}/documents`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message ?? 'Chargement impossible');
    setDocuments(data);
  }, [id]);

  useEffect(() => { load().catch((error) => setMessage(error.message)); }, [load]);

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) return setMessage('Sélectionnez un fichier.');
    setSubmitting(true);
    setMessage('');
    try {
      const body = new FormData();
      body.set('typeDocument', typeDocument);
      body.set('file', file);
      const response = await fetch(`/api/pme/dossiers/${id}/documents`, { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) throw new Error(Array.isArray(data?.message) ? data.message.join(', ') : data?.message ?? 'Envoi impossible');
      setFile(null);
      setMessage('Document envoyé et placé en attente de vérification.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Envoi impossible');
    } finally {
      setSubmitting(false);
    }
  }

  return <main className={styles.main}>
    <p className={styles.eyebrow}>Pièces justificatives</p>
    <h1 className={styles.title}>Documents du dossier</h1>
    <p className={styles.lead}>Formats acceptés : PDF, JPG et PNG. Taille maximale : 10 Mo. Chaque fichier est contrôlé, stocké de manière privée et vérifié par checksum.</p>
    <div className={styles.buttonRow}><Link className={styles.secondary} href="/entrepreneur/suivi">Retour aux dossiers</Link></div>

    <form className={`${styles.card} ${styles.formCard} ${styles.section}`} onSubmit={upload}>
      <div className={styles.formGrid}>
        <div className={styles.field}><label htmlFor="typeDocument">Type de document</label><select id="typeDocument" value={typeDocument} onChange={(event) => setTypeDocument(event.target.value)}>{documentTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className={styles.field}><label htmlFor="documentFile">Fichier</label><input id="documentFile" type="file" accept="application/pdf,image/jpeg,image/png" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></div>
      </div>
      <div className={styles.notice}>La clé de stockage est générée côté serveur. Le fichier n’est jamais rendu public et reste inaccessible aux autres PME.</div>
      {message && <div className={styles.notice} role="status">{message}</div>}
      <div className={styles.buttonRow}><button className={styles.primary} disabled={submitting}>{submitting ? 'Envoi sécurisé…' : 'Envoyer le document'}</button></div>
    </form>

    <section className={`${styles.card} ${styles.tableCard} ${styles.section}`} tabIndex={0} role="region" aria-label="Tableau, défilement horizontal sur petit écran">
      <table className={styles.table}><thead><tr><th>Type</th><th>Fichier</th><th>Taille</th><th>Statut</th><th>Contrôle</th><th>Action</th></tr></thead>
        <tbody>{documents.map((document) => <tr key={document.id}>
          <td>{document.typeDocument}</td>
          <td><strong>{document.nomFichier}</strong></td>
          <td>{(Number(document.tailleOctets) / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} Ko</td>
          <td><span className={styles.pill}>{document.statutVerification}</span></td>
          <td>{document.verificationComment ?? '—'}</td>
          <td><a className={styles.secondary} href={`/api/pme/documents/${document.id}/download`}>Télécharger</a></td>
        </tr>)}</tbody>
      </table>
      {documents.length === 0 && <p className={styles.lead}>Aucun document déposé.</p>}
    </section>
  </main>;
}
