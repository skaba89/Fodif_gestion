import Link from 'next/link';
import ThemeToggle from '../_shared/ThemeToggle';
import styles from '../entrepreneur/portal.module.css';
import { AuditeurAccountMenu } from './components/AuditeurAccountMenu';

export default function AuditeurLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.shell}>
    <header className={styles.header}>
      <Link href="/auditeur/tableau-de-bord" className={styles.brand}><span className={styles.mark}>FD</span><span className={styles.brandText}><strong>FODIP DIGITAL</strong><span>Auditeur</span></span></Link>
      <nav className={styles.nav} aria-label="Navigation Auditeur"><Link href="/auditeur/tableau-de-bord">Supervision</Link></nav>
      <div className={styles.headerActions}><ThemeToggle buttonClassName={styles.themeToggle} /><AuditeurAccountMenu /></div>
    </header>
    {children}
    <footer className={styles.footer}>FODIP Digital 2030 · Accès en lecture seule, intégralement journalisé</footer>
  </div>;
}
