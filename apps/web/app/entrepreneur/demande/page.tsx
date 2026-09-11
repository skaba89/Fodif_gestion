'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientApi } from '../../../lib/client-api';
import Breadcrumbs from '../../_shared/Breadcrumbs';
import Button from '../../_shared/Button';
import styles from '../portal.module.css';

type RequiredDocument = {
  code: string;
  libelle: string;
  typeDocument: string;
  obligatoire: boolean;
  validiteJours?: number | null;
};

type Program = {
  id: string;
  nom: string;
  description?: string;
  montantMin?: string;
  montantMax?: string;
  enveloppeTotale?: string | null;
  apportMinPct?: string | null;
  ancienneteMinMois?: number | null;
  rccmRequis?: boolean;
  nifRequis?: boolean;
  slaInstructionJours?: number | null;
  documentsRequis?: RequiredDocument[];
};

function money(value?: string | null) {
  if (!value) return null;
  return `${Number(value).toLocaleString('fr-FR')} GNF`;
}

export default function FundingApplicationPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programmeId, setProgrammeId] = useState('');
  const [montant, setMontant] = useState('');
  const [apport, setApport] = useState('0');
  const [objet, setObjet] = useState('');
  const [description, setDescription] = useState('');
  const [emplois, setEmplois] = useState('0');
  const [message, setMessage] = useState('');

  useEffect(() => {
    clientApi<Program[]>('/api/programmes')
      .then((items) => {
        setPrograms(items);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Chargement impossible'));
  }, []);

  const selectedProgram = useMemo(
    () => programs.find((program) => program.id === programmeId) ?? null,
    [programs, programmeId],
  );

  const mandatoryDocuments = useMemo(
    () => (selectedProgram?.documentsRequis ?? []).filter((document) => document.obligatoire),
    [selectedProgram],
  );

  async function save(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      await clientApi('/api/pme/dossiers', {
        method: 'POST',
        body: JSON.stringify({
          programmeId,
          montantDemande: Number(montant),
          apportPersonnel: Number(apport || 0),
          objetFinancement: objet,
          descriptionProjet: description || undefined,
          nombreEmploisPrevus: Number(emplois || 0),
        }),
      });
      router.push('/entrepreneur/suivi');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Création impossible');
    }
  }

  return (
    <main className={styles.main}>
      <Breadcrumbs items={[
        { label: 'Entrepreneur', href: '/entrepreneur' },
        { label: 'Nouvelle demande' },
      ]} />
      <p className={styles.eyebrow}>Nouvelle demande</p>
      <h1 className={styles.title}>Demande de financement</h1>
      <p className={styles.lead}>Sélectionnez un programme pour connaître ses règles et les pièces à préparer avant l’instruction.</p>

      <form className={`${styles.card} ${styles.formCard} ${styles.section}`} onSubmit={save}>
        <div className={styles.formGrid}>
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label htmlFor="programmeId">Programme</label>
            <select id="programmeId" required value={programmeId} onChange={(event) => setProgrammeId(event.target.value)}>
              <option value="">Sélectionner</option>
              {programs.map((program) => <option key={program.id} value={program.id}>{program.nom}</option>)}
            </select>
          </div>

          {selectedProgram ? (
            <div className={`${styles.notice} ${styles.fieldFull}`} role="status">
              <strong>{selectedProgram.nom}</strong>
              {selectedProgram.description ? <p>{selectedProgram.description}</p> : null}
              <p>
                Montant : {money(selectedProgram.montantMin) ?? 'minimum non défini'} → {money(selectedProgram.montantMax) ?? 'maximum non défini'}
                {selectedProgram.apportMinPct ? ` · apport minimal ${Number(selectedProgram.apportMinPct).toLocaleString('fr-FR')} %` : ''}
                {selectedProgram.ancienneteMinMois != null ? ` · ancienneté minimale ${selectedProgram.ancienneteMinMois} mois` : ''}
              </p>
              {(selectedProgram.rccmRequis || selectedProgram.nifRequis || mandatoryDocuments.length > 0) ? (
                <>
                  <strong>Pièces et justificatifs à préparer</strong>
                  <ul>
                    {mandatoryDocuments.map((document) => (
                      <li key={document.code}>
                        {document.libelle}{document.validiteJours ? ` — validité maximale ${document.validiteJours} jours` : ''}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>Aucune pièce obligatoire n’est configurée pour ce programme à ce stade.</p>
              )}
            </div>
          ) : null}

          <div className={styles.field}>
            <label htmlFor="montant">Montant demandé (GNF)</label>
            <input id="montant" required type="number" min="1" value={montant} onChange={(event) => setMontant(event.target.value)} />
          </div>
          <div className={styles.field}>
            <label htmlFor="apport">Apport personnel (GNF)</label>
            <input id="apport" type="number" min="0" value={apport} onChange={(event) => setApport(event.target.value)} />
          </div>
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label htmlFor="objet">Objet du financement</label>
            <input id="objet" required value={objet} onChange={(event) => setObjet(event.target.value)} />
          </div>
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label htmlFor="description">Description du projet</label>
            <textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <div className={styles.field}>
            <label htmlFor="emplois">Emplois directs prévus</label>
            <input id="emplois" type="number" min="0" value={emplois} onChange={(event) => setEmplois(event.target.value)} />
          </div>
        </div>

        <div className={styles.notice}>Le brouillon peut être enregistré immédiatement. Les pièces sont déposées ensuite depuis « Documents » dans le suivi.</div>
        {message ? <div className={styles.notice}>{message}</div> : null}
        <div className={styles.buttonRow}>
          <Button type="submit">Enregistrer le brouillon</Button>
        </div>
      </form>
    </main>
  );
}
