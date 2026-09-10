import Link from 'next/link';
import FodipOfficialBrand from './_shared/FodipOfficialBrand';
import ThemeToggle from './_shared/ThemeToggle';
import styles from './home.module.css';

const portals = [
  {
    mark: 'PM',
    title: 'Espace PME',
    description: 'Déposer et suivre les demandes, compléter les pièces et suivre les décisions et financements.',
  },
  {
    mark: 'AG',
    title: 'Agent FODIP',
    description: 'Instruire les dossiers, vérifier les documents et produire une analyse traçable.',
  },
  {
    mark: 'CO',
    title: 'Comité de financement',
    description: 'Examiner les dossiers prêts, apprécier le risque et formaliser les décisions humaines.',
  },
  {
    mark: 'DI',
    title: 'Direction',
    description: 'Piloter le portefeuille, les décaissements, remboursements, risques et impacts.',
  },
  {
    mark: 'AD',
    title: 'Administration',
    description: 'Administrer les comptes, rôles et habilitations sous contrôle et journalisation.',
  },
  {
    mark: 'AU',
    title: 'Auditeur',
    description: 'Consulter en lecture seule le portefeuille et les traces d’audit de la plateforme.',
  },
  {
    mark: 'PB',
    title: 'Partenaire bancaire',
    description: 'Suivre le portefeuille autorisé et déclarer les opérations bancaires prévues par le dispositif.',
  },
];

const valueChain = [
  ['01', 'Dossier', 'Dépôt et complétude'],
  ['02', 'Instruction', 'Analyse et scoring'],
  ['03', 'Décision', 'Comité et traçabilité'],
  ['04', 'Financement', 'Décaissement et échéancier'],
  ['05', 'Suivi', 'Remboursement et impact'],
];

export default function HomePage() {
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <FodipOfficialBrand subtitle="FODIP Digital 2030" />
        </div>
        <div className={styles.headerActions}>
          <span className={styles.badge}>Plateforme institutionnelle</span>
          <ThemeToggle buttonClassName={styles.themeToggle} />
        </div>
      </header>

      <div className={styles.heroGrid}>
        <section className={styles.hero} aria-labelledby="home-title">
          <p className={styles.eyebrow}>Plateforme nationale de financement des PME</p>
          <h1 id="home-title" className={styles.title}>Piloter le financement des PME guinéennes de la demande jusqu’à l’impact.</h1>
          <p className={styles.lead}>
            FODIP Digital 2030 réunit entreprises accompagnées, équipes d’instruction, comité, Direction,
            partenaires bancaires et audit autour d’un même référentiel sécurisé et traçable.
          </p>
          <div className={styles.heroActions}>
            <Link href="/connexion" className={styles.primaryAction}>Accéder à la plateforme</Link>
            <span className={styles.accessNote}>Un point d’accès unique, puis une orientation automatique selon les rôles autorisés.</span>
          </div>
        </section>

        <aside className={styles.executiveCard} aria-label="Chaîne de valeur FODIP Digital 2030">
          <div>
            <p className={styles.executiveKicker}>Chaîne de valeur</p>
            <h2>Une continuité de gestion, de décision et de contrôle.</h2>
          </div>
          <div className={styles.valueChain}>
            {valueChain.map(([step, title, detail]) => (
              <div className={styles.valueStep} key={step}>
                <span>{step}</span>
                <div><strong>{title}</strong><small>{detail}</small></div>
              </div>
            ))}
          </div>
          <p className={styles.executiveNote}>Les mêmes données suivent le dossier tout au long du processus afin de limiter les ruptures de traçabilité entre acteurs.</p>
        </aside>
      </div>

      <section className={styles.roleSection} aria-labelledby="roles-title">
        <div className={styles.sectionIntro}>
          <div>
            <p className={styles.eyebrow}>Espaces métiers</p>
            <h2 id="roles-title">Une expérience adaptée à chaque responsabilité.</h2>
          </div>
          <p>Chaque profil retrouve les informations et actions de son périmètre. Les habilitations restent contrôlées côté API, indépendamment de l’interface.</p>
        </div>

        <div className={styles.portals}>
          {portals.map((portal) => (
            <article key={portal.title} className={styles.portalCard}>
              <span className={styles.portalIcon}>{portal.mark}</span>
              <div>
                <h3>{portal.title}</h3>
                <p>{portal.description}</p>
              </div>
              <span className={styles.portalCta}>Accès selon habilitation</span>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.principles} aria-label="Principes de confiance">
        <div className={styles.principle}>
          <strong>Isolation des données</strong>
          <span>Chaque compte n’accède qu’à son périmètre autorisé, contrôlé à chaque requête par l’API.</span>
        </div>
        <div className={styles.principle}>
          <strong>Traçabilité complète</strong>
          <span>Décisions, opérations de financement et actions sensibles sont journalisées pour l’audit.</span>
        </div>
        <div className={styles.principle}>
          <strong>Authentification renforcée</strong>
          <span>Double authentification pour les comptes sensibles et SSO pour les comptes institutionnels configurés.</span>
        </div>
        <div className={styles.principle}>
          <strong>Contrôle d’accès strict</strong>
          <span>Après authentification, chaque compte est dirigé vers l’espace autorisé par ses rôles.</span>
        </div>
      </section>

      <footer className={styles.footer}>FODIP Digital 2030 — Plateforme de gestion, de financement, de suivi et de pilotage des PME accompagnées par le FODIP en Guinée · <Link href="/design-system">Design system</Link></footer>
    </main>
  );
}
