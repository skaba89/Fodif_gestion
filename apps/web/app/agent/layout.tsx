import Link from 'next/link';
import styles from '../entrepreneur/portal.module.css';
import { AgentAccountMenu } from './components/AgentAccountMenu';

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.shell}>
    <header className={styles.header}>
      <Link href="/agent/dossiers" className={styles.brand}><span className={styles.mark}>FD</span><span className={styles.brandText}><strong>FODIP DIGITAL</strong><span>Espace Agent</span></span></Link>
      <nav className={styles.nav} aria-label="Navigation Agent"><Link href="/agent/dossiers">Dossiers</Link><Link href="/notifications">Notifications</Link></nav>
      <AgentAccountMenu />
    </header>
    {children}
    <footer className={styles.footer}>FODIP Digital 2030 · Instruction sécurisée des dossiers</footer>
  </div>;
}
