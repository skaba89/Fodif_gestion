import Link from 'next/link';
import styles from '../entrepreneur/portal.module.css';
import { CommitteeAccountMenu } from './components/CommitteeAccountMenu';

export default function CommitteeLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.shell}>
    <header className={styles.header}>
      <Link href="/comite/dossiers" className={styles.brand}><span className={styles.mark}>FD</span><span className={styles.brandText}><strong>FODIP DIGITAL</strong><span>Comité de financement</span></span></Link>
      <nav className={styles.nav} aria-label="Navigation Comité"><Link href="/comite/dossiers">Séance décisionnelle</Link><Link href="/notifications">Notifications</Link></nav>
      <CommitteeAccountMenu />
    </header>
    {children}
    <footer className={styles.footer}>FODIP Digital 2030 · Décisions humaines, motivées et auditées</footer>
  </div>;
}
