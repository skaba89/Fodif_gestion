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

const STEPS = ['Programme', 'Financement', 'Projet', 'Vérification'] as const;

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
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
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

  function nextStep() {
    setMessage('');

    if (step === 0 && !programmeId) {
      setMessage('Sélectionnez un programme pour continuer.');
      return;
    }

    if (step === 1) {
      if (!montant || Number(montant) <= 0) {
        setMessage('Renseignez un montant demandé supérieur à zéro.');
        return;
      }
      if (Number(apport || 0) < 0) {
        setMessage('L’apport personnel ne peut pas être négatif.');
        return;
      }
      if (!objet.trim()) {
        setMessage('Renseignez l’objet du financement.');
        return;
      }
    }

    if (step === 2 && Number(emplois || 0) < 0) {
      setMessage('Le nombre d’emplois prévus ne peut pas être négatif.');
      return;
    }

    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function previousStep() {
    setMessage('');
    setStep((current) => Math.max(current - 1, 0));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (step !== STEPS.length - 1 || saving) return;

    setMessage('');
    setSaving(true);
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
    } finally {
      setSaving(false);
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
      <p className={styles.lead}>Avancez étape par étape : le programme fixe les règles et les pièces à préparer, puis vous vérifiez le brouillon avant son enregistrement.</p>

      <div className={styles.wizard}>
        <aside className={`${styles.card} ${styles.wizardSteps}`} aria-label="Étapes de la demande">
          {STEPS.map((label, index) => (
            <div
              key={label}
              className={`${styles.wizardStep} ${index === step ? styles.wizardStepActive : ''}`}
              aria-current={index === step ? 'step' : undefined}
            >
              {index + 1}. {label}
            </div>
          ))}
        </aside>

        <form className={`${styles.card} ${styles.formCard}`} onSubmit={save}>
          {step === 0 ? (
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
            </div>
          ) : null}

          {step === 1 ? (
            <div className={styles.formGrid}>
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
              {selectedProgram ? (
                <div className={`${styles.notice} ${styles.fieldFull}`} role="status">
                  Programme choisi : <strong>{selectedProgram.nom}</strong>. Les règles affichées à l’étape précédente restent la référence et seront contrôlées par la plateforme lors du traitement.
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className={styles.formGrid}>
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label htmlFor="description">Description du projet</label>
                <textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} />
              </div>
              <div className={styles.field}>
                <label htmlFor="emplois">Emplois directs prévus</label>
                <input id="emplois" type="number" min="0" value={emplois} onChange={(event) => setEmplois(event.target.value)} />
              </div>
              <div className={`${styles.notice} ${styles.fieldFull}`} role="note">
                Le brouillon peut être enregistré sans déposer les pièces maintenant. Les documents obligatoires ({mandatoryDocuments.length}) seront ajoutés ensuite depuis « Documents » dans le suivi.
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className={styles.formGrid}>
              <div className={`${styles.notice} ${styles.fieldFull}`} role="status">
                <strong>Vérifiez votre brouillon avant enregistrement</strong>
                <p><strong>Programme :</strong> {selectedProgram?.nom ?? '—'}</p>
                <p><strong>Montant demandé :</strong> {money(montant) ?? '—'}</p>
                <p><strong>Apport personnel :</strong> {money(apport) ?? '0 GNF'}</p>
                <p><strong>Objet :</strong> {objet || '—'}</p>
                <p><strong>Description :</strong> {description || 'Non renseignée'}</p>
                <p><strong>Emplois directs prévus :</strong> {Number(emplois || 0).toLocaleString('fr-FR')}</p>
                <p><strong>Pièces obligatoires à préparer :</strong> {mandatoryDocuments.length}</p>
              </div>
              <div className={`${styles.notice} ${styles.fieldFull}`} role="note">
                L’enregistrement crée uniquement un brouillon. Vous pourrez encore déposer les documents puis soumettre le dossier depuis le suivi.
              </div>
            </div>
          ) : null}

          {message ? <div className={`${styles.notice} ${styles.section}`} role="alert">{message}</div> : null}
          <div className={styles.buttonRow}>
            {step > 0 ? <Button type="button" variant="secondary" onClick={previousStep}>Précédent</Button> : null}
            {step < STEPS.length - 1 ? (
              <Button key="continue" type="button" onClick={nextStep}>Continuer</Button>
            ) : (
              <Button key="save" type="submit" loading={saving}>Enregistrer le brouillon</Button>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}
