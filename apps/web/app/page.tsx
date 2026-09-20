import Link from 'next/link';
import FodipOfficialBrand from './_shared/FodipOfficialBrand';
import ThemeToggle from './_shared/ThemeToggle';
import styles from './home.module.css';

const financingCycle = [
  ['01', 'Dépôt', 'La PME prépare sa demande et transmet les pièces requises.'],
  ['02', 'Instruction', 'Un agent vérifie le dossier, les documents et les éléments d’analyse.'],
  ['03', 'Décision', 'Le comité examine le dossier et enregistre une décision humaine et traçable.'],
  ['04', 'Financement', 'Les financements, décaissements et échéanciers sont suivis dans le même référentiel.'],
  ['05', 'Suivi', 'Remboursements, impact et opérations de contrôle restent consultables dans la durée.'],
];

const operatingModel = [
  {
    title: 'Dépôt et instruction',
    actors: 'PME · Agents FODIP',
    description: 'La demande, les pièces justificatives, les compléments et l’analyse restent rattachés au même dossier.',
  },
  {
    title: 'Décision et mise en financement',
    actors: 'Comité · Direction · Partenaires bancaires',
    description: 'Les décisions, montants accordés, décaissements et échéanciers sont enregistrés avec leur historique.',
  },
  {
    title: 'Suivi et contrôle',
    actors: 'Direction · Audit · Administration',
    description: 'Remboursements, indicateurs d’impact, habilitations et actions sensibles restent disponibles pour le pilotage et l’audit.',
  },
];

const accessGroups = [
  ['Entreprises accompagnées', 'Déposer une demande, compléter les pièces et suivre les étapes du financement.'],
  ['Instruction et décision', 'Traiter les dossiers, documenter l’analyse et enregistrer les décisions du comité.'],
  ['Pilotage et administration', 'Suivre le portefeuille, les risques, les accès, les programmes et la traçabilité.'],
  ['Partenaires et contrôle', 'Consulter le périmètre autorisé, suivre les opérations bancaires et contrôler les traces d’audit.'],
];

export default function HomePage() {
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <FodipOfficialBrand subtitle="FODIP Digital 2030" />
        </div>
        <div className={styles.headerActions}>
          <span className={styles.badge}>Portail institutionnel</span>
          <ThemeToggle buttonClassName={styles.themeToggle} />
        </div>
      </header>

      <section className={styles.hero} aria-labelledby="home-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Plateforme nationale de financement des PME</p>
          <h1 id="home-title" className={styles.title}>
            Gérer le cycle de financement d’une PME, du dépôt de la demande au suivi du remboursement.
          </h1>
          <p className={styles.lead}>
            FODIP Digital 2030 réunit les entreprises accompagnées, les équipes d’instruction, le comité,
            la Direction, les partenaires bancaires, l’administration et l’audit autour d’un même dossier
            sécurisé et traçable.
          </p>
          <div className={styles.heroActions}>
            <Link href="/connexion" className={styles.primaryAction}>Accéder à la plateforme</Link>
            <p className={styles.accessNote}>
              Un point d’accès unique. Après authentification, chaque compte est dirigé vers l’espace autorisé par ses habilitations.
            </p>
          </div>
        </div>

        <aside className={styles.cyclePanel} aria-label="Cycle de financement géré dans FODIP Digital 2030">
          <p className={styles.sectionKicker}>Cycle de financement</p>
          <h2>Un dossier suivi de bout en bout.</h2>
          <div className={styles.cycleList}>
            {financingCycle.map(([step, title, detail]) => (
              <div className={styles.cycleStep} key={step}>
                <span className={styles.cycleIndex}>{step}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className={styles.operatingSection} aria-labelledby="operation-title">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionKicker}>Fonctionnement</p>
            <h2 id="operation-title">Du dépôt au contrôle, les responsabilités restent séparées.</h2>
          </div>
          <p>
            Chaque acteur intervient dans son périmètre. Les habilitations sont contrôlées par l’API et les opérations sensibles restent journalisées.
          </p>
        </div>

        <div className={styles.operatingRows}>
          {operatingModel.map((item, index) => (
            <article className={styles.operatingRow} key={item.title}>
              <span className={styles.rowIndex}>{String(index + 1).padStart(2, '0')}</span>
              <div className={styles.rowTitle}>
                <h3>{item.title}</h3>
                <span>{item.actors}</span>
              </div>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.accessSection} aria-labelledby="access-title">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionKicker}>Accès métiers</p>
            <h2 id="access-title">Un accès unique, des responsabilités distinctes.</h2>
          </div>
          <p>
            L’interface présentée après connexion dépend des habilitations du compte. Les espaces ne donnent pas les mêmes droits ni les mêmes actions.
          </p>
        </div>

        <div className={styles.accessList}>
          {accessGroups.map(([title, description]) => (
            <div className={styles.accessRow} key={title}>
              <strong>{title}</strong>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.trustSection} aria-labelledby="trust-title">
        <div className={styles.trustIntro}>
          <p className={styles.sectionKicker}>Gouvernance</p>
          <h2 id="trust-title">Sécurité et traçabilité intégrées au fonctionnement.</h2>
        </div>
        <dl className={styles.trustList}>
          <div>
            <dt>Accès</dt>
            <dd>Chaque requête est limitée au périmètre autorisé du compte.</dd>
          </div>
          <div>
            <dt>Authentification</dt>
            <dd>Les comptes sensibles peuvent être soumis à une authentification renforcée.</dd>
          </div>
          <div>
            <dt>Décisions</dt>
            <dd>Les décisions métier restent humaines et sont enregistrées avec leur historique.</dd>
          </div>
          <div>
            <dt>Audit</dt>
            <dd>Les opérations sensibles sont journalisées pour permettre leur contrôle.</dd>
          </div>
        </dl>
      </section>

      <footer className={styles.footer}>
        FODIP Digital 2030 — Plateforme de gestion, de financement, de suivi et de pilotage des PME accompagnées par le FODIP en Guinée.
      </footer>
    </main>
  );
}
