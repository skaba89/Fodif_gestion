import Link from 'next/link';
import ThemeToggle from './_shared/ThemeToggle';
import styles from './home.module.css';

const portals = [
  {
    href: '/entrepreneur/connexion',
    mark: 'PM',
    title: 'Espace PME',
    description: "Déposez et suivez vos dossiers de financement, gérez les informations de votre entreprise.",
  },
  {
    href: '/agent/connexion',
    mark: 'AG',
    title: 'Agent FODIP',
    description: 'Instruisez les dossiers, vérifiez les documents et notez les demandes de financement.',
  },
  {
    href: '/comite/connexion',
    mark: 'CO',
    title: 'Comité de financement',
    description: 'Consultez les dossiers prêts pour décision et statuez en toute traçabilité.',
  },
  {
    href: '/direction/connexion',
    mark: 'DI',
    title: 'Direction',
    description: 'Pilotez le portefeuille national : indicateurs, impact économique et social, régions.',
  },
  {
    href: '/administration/connexion',
    mark: 'AD',
    title: 'Administration',
    description: 'Gérez les comptes, rôles et permissions de la plateforme, sous contrôle et audit.',
  },
  {
    href: '/auditeur/connexion',
    mark: 'AU',
    title: 'Auditeur',
    description: 'Consultez en lecture seule le portefeuille de financements et le journal d’audit de la plateforme.',
  },
  {
    href: '/partenaire/connexion',
    mark: 'PB',
    title: 'Partenaire bancaire',
    description: 'Consultez vos financements correspondants et déclarez vos décaissements et remboursements pour le compte du FODIP.',
  },
];

export default function HomePage() {
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.mark}>FD</span>
          <span className={styles.brandText}>
            <strong>FODIP DIGITAL</strong>
            <span>2030</span>
          </span>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.badge}>Plateforme institutionnelle</span>
          <ThemeToggle buttonClassName={styles.themeToggle} />
        </div>
      </header>

      <div className={styles.hero}>
        <p className={styles.eyebrow}>Plateforme nationale de financement des PME</p>
        <h1 className={styles.title}>Le référentiel unique du financement, du suivi et de l’impact des PME guinéennes.</h1>
        <p className={styles.lead}>
          Du dépôt d’un dossier de financement jusqu’au remboursement et au suivi d’impact, FODIP Digital 2030
          connecte les entreprises accompagnées, les agents d’instruction, le comité de financement et la
          Direction sur une même plateforme sécurisée.
        </p>
      </div>

      <nav className={styles.portals} aria-label="Choix de l’espace">
        {portals.map((portal) => (
          <Link key={portal.href} href={portal.href} className={styles.portalCard}>
            <span className={styles.portalIcon}>{portal.mark}</span>
            <h2>{portal.title}</h2>
            <p>{portal.description}</p>
            <span className={styles.portalCta}>Accéder à l’espace →</span>
          </Link>
        ))}
      </nav>

      <div className={styles.principles}>
        <div className={styles.principle}>
          <strong>Isolation des données</strong>
          <span>Chaque PME n’accède qu’à ses propres dossiers, contrôlé à chaque requête.</span>
        </div>
        <div className={styles.principle}>
          <strong>Traçabilité complète</strong>
          <span>Décisions de comité, décaissements et remboursements journalisés et audités.</span>
        </div>
        <div className={styles.principle}>
          <strong>Authentification renforcée</strong>
          <span>Double authentification disponible pour les comptes sensibles.</span>
        </div>
        <div className={styles.principle}>
          <strong>Contrôle d’accès strict</strong>
          <span>Rôles et permissions dédiés à chaque métier : PME, agent, comité, direction.</span>
        </div>
      </div>

      <footer className={styles.footer}>FODIP Digital 2030 — Plateforme de gestion, de financement, de suivi et de pilotage des PME accompagnées par le FODIP en Guinée · <Link href="/design-system">Design system</Link></footer>
    </main>
  );
}
