import Link from 'next/link';
import ThemeToggle from '../_shared/ThemeToggle';
import styles from '../entrepreneur/portal.module.css';
import { CommitteeAccountMenu } from './components/CommitteeAccountMenu';

export default function CommitteeLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.shell}>
    <a href="#main-content" className="skip-link">Aller au contenu principal</a>
    <header className={styles.header}>
      <Link href="/comite/dossiers" className={styles.brand}><span className={styles.mark}>FD</span><span className={styles.brandText}><strong>FODIP DIGITAL</strong><span>Comité de financement</span></span></Link>
      <nav className={styles.nav} aria-label="Navigation Comité"><Link href="/comite/dossiers">Séance décisionnelle</Link><Link href="/notifications">Notifications</Link><Link href="/mes-donnees">Mes données</Link></nav>
      <div className={styles.headerActions}><ThemeToggle buttonClassName={styles.themeToggle} /><CommitteeAccountMenu /></div>
    </header>
    <div id="main-content" tabIndex={-1}>{children}</div>
    <footer className={styles.footer}>FODIP Digital 2030 · Décisions humaines, motivées et auditées</footer>
  </div>;
}
