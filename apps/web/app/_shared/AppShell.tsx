'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import ThemeToggle from './ThemeToggle';
import Drawer from './Drawer';
import { MenuIcon } from './Icons';
import styles from '../entrepreneur/portal.module.css';

export interface AppShellNavItem {
  label: string;
  href: string;
}

/**
 * Shared header + navigation shell for every authenticated portal - mission "présentation
 * Directeur général" (section 6, mobile navigation; section 7, "AppShell" in the components to
 * mutualize list). Replaces each portal's own inline `<header>...<nav>...` markup (previously
 * duplicated near-verbatim across entrepreneur/agent/comite/administration/auditeur/partenaire's
 * layout.tsx, and inlined a third way again inside direction/tableau-de-bord/page.tsx).
 *
 * Fixes the real, previously-diagnosed bug this mission calls out by name (see
 * apps/web/playwright.config.ts's own file-level comment, written when the two mobile Playwright
 * projects were deliberately left disabled pending exactly this fix): entrepreneur/portal.module.css
 * hid `.nav` outright below 900px with nothing to replace it - unusable, not just visually
 * different, on any phone-width viewport. Below that same breakpoint this component now shows a
 * 44×44px hamburger button opening an accessible Drawer (focus trap, Escape-to-close, focus
 * return - see Drawer.tsx) carrying the identical nav items and account menu, rather than nothing.
 */
export default function AppShell({
  portalLabel,
  homeHref,
  navItems,
  accountMenu,
  footer,
  children,
}: {
  portalLabel: string;
  homeHref: string;
  navItems: AppShellNavItem[];
  accountMenu: React.ReactNode;
  footer: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/config', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data?.demoMode) setDemoMode(true); })
      .catch(() => { /* config unreachable - default to no banner, never block the portal on it */ });
    return () => controller.abort();
  }, []);

  return (
    <div className={styles.shell}>
      <a href="#main-content" className="skip-link">Aller au contenu principal</a>
      {demoMode && (
        <div className={styles.demoBanner} role="status">
          Données de démonstration — aucune donnée réelle
        </div>
      )}
      <header className={styles.header}>
        <Link href={homeHref} className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">FD</span>
          <span className={styles.brandText}><strong>FODIP DIGITAL</strong><span>{portalLabel}</span></span>
        </Link>
        <nav className={styles.nav} aria-label={`Navigation ${portalLabel}`}>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} aria-current={pathname === item.href ? 'page' : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className={styles.headerActions}>
          <ThemeToggle buttonClassName={styles.themeToggle} />
          <span className={styles.accountDesktop}>{accountMenu}</span>
          <button
            type="button"
            className={styles.hamburger}
            aria-label="Ouvrir le menu de navigation"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <MenuIcon aria-hidden />
          </button>
        </div>
      </header>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={portalLabel}>
        <nav className={styles.drawerNav} aria-label={`Navigation ${portalLabel}`}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setDrawerOpen(false)}
              aria-current={pathname === item.href ? 'page' : undefined}
              className={pathname === item.href ? styles.drawerNavItemActive : styles.drawerNavItem}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className={styles.drawerAccount}>{accountMenu}</div>
      </Drawer>

      <div id="main-content" tabIndex={-1}>{children}</div>
      <footer className={styles.footer}>{footer}</footer>
    </div>
  );
}
