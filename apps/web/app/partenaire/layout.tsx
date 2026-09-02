import Link from 'next/link';
import styles from '../entrepreneur/portal.module.css';
import { PartenaireAccountMenu } from './components/PartenaireAccountMenu';

export default function PartenaireLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.shell}>
    <header className={styles.header}>
      <Link href="/partenaire/financements" className={styles.brand}><span className={styles.mark}>FD</span><span className={styles.brandText}><strong>FODIP DIGITAL</strong><span>Partenaire bancaire</span></span></Link>
      <nav className={styles.nav} aria-label="Navigation Partenaire"><Link href="/partenaire/financements">Portefeuille</Link></nav>
      <PartenaireAccountMenu />
    </header>
    {children}
    <footer className={styles.footer}>FODIP Digital 2030 · Accès strictement limité à votre périmètre, intégralement journalisé</footer>
  </div>;
}
