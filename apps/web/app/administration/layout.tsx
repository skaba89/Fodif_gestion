import Link from 'next/link';
import ThemeToggle from '../_shared/ThemeToggle';
import portal from '../entrepreneur/portal.module.css';
import { AdministrationAccountMenu } from './components/AdministrationAccountMenu';

export default function AdministrationLayout({ children }: { children: React.ReactNode }) {
  return <div className={portal.shell}><header className={portal.header}>
    <Link href="/administration/utilisateurs" className={portal.brand}><span className={portal.mark}>FD</span><span className={portal.brandText}><strong>FODIP DIGITAL</strong><span>Administration</span></span></Link>
    <nav className={portal.nav} aria-label="Navigation Administration"><Link href="/administration/utilisateurs">Utilisateurs et rôles</Link><Link href="/notifications">Notifications</Link></nav>
    <div className={portal.headerActions}><ThemeToggle buttonClassName={portal.themeToggle} /><AdministrationAccountMenu /></div>
  </header>{children}<footer className={portal.footer}>FODIP Digital 2030 · Administration auditée</footer></div>;
}

