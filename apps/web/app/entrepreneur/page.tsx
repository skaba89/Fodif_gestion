'use client';

import { useEffect, useMemo, useState } from 'react';
import { clientApi } from '../../lib/client-api';
import Button from '../_shared/Button';
import InstitutionalIllustration from '../_shared/InstitutionalIllustration';
import KpiCard from '../_shared/KpiCard';
import Skeleton from '../_shared/Skeleton';
import { DossierStatusBadge } from '../_shared/StatusBadge';
import WorkflowStepper from '../_shared/WorkflowStepper';
import { dossierProgressPercent } from '../_shared/dossierStatus';
import role from '../_shared/RoleDashboard.module.css';
import styles from './portal.module.css';

type Company = { codeFodip: string; raisonSociale: string };
type MissingDocument = { code: string; libelle: string; typeDocument: string };
type Application = {
  id: string;
  numeroDossier?: string;
  statut: string;
  montantDemande: string | number;
  createdAt?: string;
  dateSoumission?: string;
  documentsRequis?: number;
  documentsPresents?: number;
  documentsManquants?: MissingDocument[];
  completudeDocumentsPct?: number;
};
type Program = { id: string; nom: string; description?: string };

const WORKFLOW_STEPS = [
  { label: 'Dossier', description: 'Préparation et pièces' },
  { label: 'Instruction', description: 'Analyse FODIP' },
  { label: 'Décision', description: 'Examen et validation' },
  { label: 'Financement', description: 'Décaissement' },
  { label: 'Suivi', description: 'Remboursement et impact' },
];

function workflowIndex(status: string) {
  if (['BROUILLON'].includes(status)) return 0;
  if (['SOUMIS', 'EN_INSTRUCTION', 'COMPLEMENT_REQUIS'].includes(status)) return 1;
  if (['PRET_COMITE', 'APPROUVE', 'REJETE'].includes(status)) return 2;
  if (['FINANCE', 'FINANCEE', 'DECAISSE', 'DECAISSEMENT'].includes(status)) return 3;
  if (['REMBOURSE', 'CLOTURE'].includes(status)) return 4;
  return 0;
}

function nextActionFor(dossier: Application | null) {
  if (!dossier) return 'Créer votre première demande de financement.';
  const missing = dossier.documentsManquants?.length ?? 0;
  if (missing > 0 && ['BROUILLON', 'COMPLEMENT_REQUIS'].includes(dossier.statut)) return `Ajouter ${missing} pièce${missing > 1 ? 's' : ''} manquante${missing > 1 ? 's' : ''}.`;
  if (dossier.statut === 'BROUILLON') return 'Vérifier le dossier puis le soumettre au FODIP.';
  if (dossier.statut === 'COMPLEMENT_REQUIS') return 'Consulter la demande de complément et mettre à jour les pièces.';
  if (dossier.statut === 'SOUMIS') return 'Aucune action requise : le dossier attend sa prise en charge.';
  if (dossier.statut === 'EN_INSTRUCTION') return 'Aucune action requise : votre dossier est en cours d’analyse.';
  if (dossier.statut === 'PRET_COMITE') return 'Aucune action requise : le dossier est prêt pour le comité.';
  if (dossier.statut === 'APPROUVE') return 'Décision favorable : suivez maintenant les étapes de financement.';
  if (dossier.statut === 'REJETE') return 'Consultez la décision avant toute nouvelle demande.';
  return 'Consultez le suivi détaillé de votre dossier.';
}

export default function EntrepreneurDashboard() {
  const [company, setCompany] = useState<Company | null>(null);
  const [dossiers, setDossiers] = useState<Application[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      clientApi<Company>('/api/pme/entreprise'),
      clientApi<Application[]>('/api/pme/dossiers'),
      clientApi<Program[]>('/api/programmes'),
    ])
      .then(([c, d, p]) => { setCompany(c); setDossiers(d); setPrograms(p); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Chargement impossible'))
      .finally(() => setLoading(false));
  }, []);

  const drafts = dossiers.filter((d) => d.statut === 'BROUILLON').length;
  const active = dossiers.filter((d) => !['BROUILLON', 'CLOTURE', 'REJETE', 'ANNULE'].includes(d.statut)).length;
  const totalRequested = useMemo(() => dossiers.reduce((sum, d) => sum + Number(d.montantDemande || 0), 0), [dossiers]);

  const leadDossier = useMemo(() => {
    if (dossiers.length === 0) return null;
    const candidates = dossiers.filter((d) => !['ANNULE', 'CLOTURE'].includes(d.statut));
    const source = candidates.length > 0 ? candidates : dossiers;
    return source.reduce((furthest, current) => (
      dossierProgressPercent(current.statut) > dossierProgressPercent(furthest.statut) ? current : furthest
    ));
  }, [dossiers]);

  const missingDocuments = leadDossier?.documentsManquants ?? [];
  const leadNumber = leadDossier?.numeroDossier ?? 'Dossier en cours';
  const leadDocumentsHref = leadDossier ? `/entrepreneur/suivi/${leadDossier.id}/documents` : '/entrepreneur/demande';
  const primaryActionHref = missingDocuments.length > 0 ? leadDocumentsHref : '/entrepreneur/suivi';
  const primaryActionLabel = missingDocuments.length > 0 ? 'Compléter mes pièces' : leadDossier ? 'Voir le suivi' : 'Créer une demande';

  return (
    <main className={styles.main}>
      <div className={role.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Espace PME</p>
          <h1 className={styles.title}>{company ? `Bonjour, ${company.raisonSociale}` : 'Tableau de bord PME'}</h1>
          <p className={styles.lead}>Votre statut et votre prochaine action sont affichés en premier, sans parcourir plusieurs écrans.</p>
        </div>
        <Button href="/entrepreneur/demande">Nouvelle demande</Button>
      </div>

      {loading ? <Skeleton lines={4} /> : null}
      {error ? <div className={styles.notice} role="alert">{error}</div> : null}

      {!loading ? (
        <section className={`${role.priorityCard} ${role.pmeHeroCard}`} aria-labelledby="pme-priority-title">
          <div className={role.priorityMain}>
            <p className={role.priorityLabel}>Votre demande maintenant</p>
            <h2 className={role.priorityTitle} id="pme-priority-title">{leadDossier ? leadNumber : 'Aucune demande en cours'}</h2>
            <p className={role.priorityDescription}>
              {leadDossier
                ? 'Le parcours ci-dessous reprend la chaîne de valeur FODIP. Le statut actuel est visible immédiatement après votre connexion.'
                : 'Démarrez une demande guidée : vous pourrez préparer le brouillon avant de le soumettre.'}
            </p>

            {leadDossier ? (
              <>
                <div className={role.statusLine}>
                  <strong>Statut actuel</strong>
                  <DossierStatusBadge status={leadDossier.statut} />
                  <span className={styles.pillMuted} data-financial>{Number(leadDossier.montantDemande).toLocaleString('fr-FR')} GNF</span>
                </div>
                <div className={role.stepperWrap}>
                  <WorkflowStepper steps={WORKFLOW_STEPS} currentIndex={workflowIndex(leadDossier.statut)} tone="inverse" />
                </div>
              </>
            ) : (
              <InstitutionalIllustration variant="pme-onboarding" className={role.pmeIllustration} />
            )}
          </div>

          <aside className={role.priorityAside} aria-label="Prochaine action PME">
            <div className={role.nextAction}>
              <span>Prochaine action</span>
              <strong>{nextActionFor(leadDossier)}</strong>
            </div>
            {leadDossier && missingDocuments.length > 0 ? (
              <div className={role.missingAlert}>
                <strong>{missingDocuments.length} pièce{missingDocuments.length > 1 ? 's' : ''} à compléter</strong>
                <span>{missingDocuments.slice(0, 2).map((document) => document.libelle).join(' · ')}{missingDocuments.length > 2 ? ` · +${missingDocuments.length - 2}` : ''}</span>
              </div>
            ) : null}
            <Button variant="secondary" href={leadDossier ? primaryActionHref : '/entrepreneur/demande'}>{primaryActionLabel}</Button>
            {leadDossier ? <Button variant="outline" href="/entrepreneur/suivi">Historique et tous les dossiers</Button> : null}
            <dl className={role.compactMeta}>
              <div><dt>Référence PME</dt><dd>{company?.codeFodip ?? '—'}</dd></div>
              {leadDossier ? <div><dt>Complétude pièces</dt><dd>{leadDossier.completudeDocumentsPct ?? 0} %</dd></div> : null}
            </dl>
          </aside>
        </section>
      ) : null}

      {!loading ? (
        <section className={styles.section} aria-labelledby="pme-overview-title">
          <div className={styles.sectionHeader}><div><h2 id="pme-overview-title">Vue d’ensemble</h2><p>Contexte utile après l’action prioritaire.</p></div></div>
          <div className={role.kpiGrid}>
            <KpiCard label="Dossiers actifs" value={String(active)} definition="Dossiers soumis et toujours en cours de traitement." detailHref="/entrepreneur/suivi" />
            <KpiCard label="Brouillons" value={String(drafts)} definition="Demandes encore modifiables avant transmission au FODIP." detailHref="/entrepreneur/suivi" />
            <KpiCard label="Montant demandé" value={totalRequested.toLocaleString('fr-FR')} unit="GNF" definition="Somme des montants demandés sur vos dossiers." detailHref="/entrepreneur/suivi" />
            <KpiCard label="Programmes ouverts" value={String(programs.length)} definition="Programmes de financement actuellement proposés par la plateforme." detailHref="/entrepreneur/programmes" />
          </div>
        </section>
      ) : null}

      {!loading && programs.length > 0 ? (
        <section className={styles.section}>
          <div className={styles.sectionHeader}><div><h2>Programmes accessibles</h2><p>À consulter uniquement après votre situation en cours.</p></div></div>
          <div className={styles.programs}>
            {programs.slice(0, 3).map((program) => (
              <article className={`${styles.card} ${styles.program}`} key={program.id}>
                <h3>{program.nom}</h3>
                <p>{program.description ?? 'Programme de financement FODIP.'}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
