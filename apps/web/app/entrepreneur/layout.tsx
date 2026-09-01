import Link from "next/link";
import styles from "./portal.module.css";

export default function EntrepreneurLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/entrepreneur" className={styles.brand}>
          <span className={styles.mark}>FD</span>
          <span className={styles.brandText}>
            <strong>FODIP DIGITAL</strong>
            <span>Espace PME</span>
          </span>
        </Link>
        <nav className={styles.nav} aria-label="Navigation PME">
          <Link href="/entrepreneur">Accueil</Link>
          <Link href="/entrepreneur/entreprise">Mon entreprise</Link>
          <Link href="/entrepreneur/demande">Nouvelle demande</Link>
          <Link href="/entrepreneur/suivi">Mes dossiers</Link>
        </nav>
        <div className={styles.account}>
          <span>Entreprise démo</span>
          <span className={styles.avatar}>ED</span>
        </div>
      </header>
      {children}
      <footer className={styles.footer}>FODIP Digital 2030 · Portail PME · Données de démonstration</footer>
    </div>
  );
}
