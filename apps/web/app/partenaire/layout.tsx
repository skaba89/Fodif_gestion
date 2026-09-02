import Link from 'next/link';
import ThemeToggle from '../_shared/ThemeToggle';
import styles from '../entrepreneur/portal.module.css';
import { PartenaireAccountMenu } from './components/PartenaireAccountMenu';

export default function PartenaireLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.shell}>
    <a href="#main-content" className="skip-link">Aller au contenu principal</a>
    <header className={styles.header}>
      <Link href="/partenaire/financements" className={styles.brand}><span className={styles.mark}>FD</span><span className={styles.brandText}><strong>FODIP DIGITAL</strong><span>Partenaire bancaire</span></span></Link>
      <nav className={styles.nav} aria-label="Navigation Partenaire"><Link href="/partenaire/financements">Portefeuille</Link><Link href="/mes-donnees">Mes données</Link></nav>
      <div className={styles.headerActions}><ThemeToggle buttonClassName={styles.themeToggle} /><PartenaireAccountMenu /></div>
    </header>
    <div id="main-content" tabIndex={-1}>{children}</div>
    <footer className={styles.footer}>FODIP Digital 2030 · Accès strictement limité à votre périmètre, intégralement journalisé</footer>
  </div>;
}
