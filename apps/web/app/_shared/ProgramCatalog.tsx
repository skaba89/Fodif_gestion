'use client';

import { useEffect, useState } from 'react';
import { clientApi } from '../../lib/client-api';
import Breadcrumbs from './Breadcrumbs';
import Button from './Button';
import styles from '../entrepreneur/portal.module.css';

type ProgramDocument = {
  code: string;
  libelle: string;
  typeDocument: string;
  obligatoire: boolean;
  validiteJours?: number | null;
};

type Program = {
  id: string;
  code: string;
  nom: string;
  description?: string | null;
  montantMin?: string | number | null;
  montantMax?: string | number | null;
  enveloppeTotale?: string | number | null;
  apportMinPct?: string | number | null;
  ancienneteMinMois?: number | null;
  rccmRequis?: boolean;
  nifRequis?: boolean;
  slaInstructionJours?: number | null;
  regleVersion?: number | null;
  documentsRequis?: ProgramDocument[];
};

function money(value?: string | number | null) {
  if (value == null || value === '') return 'Non défini';
  return `${Number(value).toLocaleString('fr-FR')} GNF`;
}

export default function ProgramCatalog({
  eyebrow,
  title,
  homeHref,
  homeLabel,
  actionHref,
  actionLabel,
}: {
  eyebrow: string;
  title: string;
  homeHref: string;
  homeLabel: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    clientApi<Program[]>('/api/programmes')
      .then(setPrograms)
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Chargement des programmes impossible'));
  }, []);

  return (
    <main className={styles.main}>
      <Breadcrumbs items={[{ label: homeLabel, href: homeHref }, { label: 'Programmes' }]} />
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.lead}>
        Consultez les programmes actuellement ouverts, leurs montants, critères d’accès, délais indicatifs et pièces requises.
        Les règles affichées proviennent de la version active du référentiel FODIP.
      </p>
      {actionHref && actionLabel ? <div className={styles.buttonRow}><Button href={actionHref}>{actionLabel}</Button></div> : null}
      {message ? <div className={`${styles.notice} ${styles.section}`} role="alert">{message}</div> : null}

      <section className={styles.section} aria-label="Programmes ouverts">
        {programs.length === 0 && !message ? (
          <div className={`${styles.card} ${styles.program}`}><h2>Aucun programme ouvert</h2><p>Aucun programme n’est actuellement publié pour de nouvelles demandes.</p></div>
        ) : null}
        <div className={styles.programs}>
          {programs.map((program) => {
            const mandatory = (program.documentsRequis ?? []).filter((document) => document.obligatoire);
            return (
              <article className={`${styles.card} ${styles.program}`} key={program.id} data-testid="program-card">
                <span className={styles.programTag}>{program.code}{program.regleVersion ? ` · V${program.regleVersion}` : ''}</span>
                <h3>{program.nom}</h3>
                {program.description ? <p>{program.description}</p> : null}
                <p><strong>Financement :</strong> {money(program.montantMin)} → {money(program.montantMax)}</p>
                {program.enveloppeTotale != null ? <p><strong>Enveloppe indicative :</strong> {money(program.enveloppeTotale)}</p> : null}
                <p>
                  <strong>Conditions :</strong>{' '}
                  {program.apportMinPct != null ? `apport ≥ ${Number(program.apportMinPct).toLocaleString('fr-FR')} %` : 'apport non paramétré'}
                  {program.ancienneteMinMois != null ? ` · ancienneté ≥ ${program.ancienneteMinMois} mois` : ''}
                  {program.rccmRequis ? ' · RCCM requis' : ''}
                  {program.nifRequis ? ' · NIF requis' : ''}
                </p>
                {program.slaInstructionJours ? <p><strong>SLA d’instruction :</strong> {program.slaInstructionJours} jours</p> : null}
                <div>
                  <strong>Pièces obligatoires</strong>
                  {mandatory.length ? (
                    <ul>{mandatory.map((document) => <li key={document.code}>{document.libelle}{document.validiteJours ? ` · validité ${document.validiteJours} jours` : ''}</li>)}</ul>
                  ) : <p>Aucune pièce obligatoire configurée pour la version active.</p>}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
