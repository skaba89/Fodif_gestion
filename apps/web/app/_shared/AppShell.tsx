'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import ThemeToggle from './ThemeToggle';
import Drawer from './Drawer';
import { MenuIcon } from './Icons';
import styles from './AppShell.module.css';
import stability from './AppShellStability.module.css';

export interface AppShellNavItem {
  label: string;
  href: string;
}

/**
 * Shared premium institutional shell for every authenticated portal.
 *
 * The component keeps all existing navigation, accessibility, responsive drawer, session-expiry
 * notice and demo-mode behaviour unchanged while centralising the visual identity of FODIP Digital.
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
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/config', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data?.demoMode) setDemoMode(true); })
      .catch(() => { /* config unreachable - default to no banner, never block the portal on it */ });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get('reason');
    setSessionExpired(reason === 'session-expired');
  }, [pathname]);

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

      {sessionExpired && (
        <div className={styles.notice} role="alert" data-testid="session-expired-notice">
          Votre session a expiré pour des raisons de sécurité. Reconnectez-vous pour continuer.
        </div>
      )}

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

      <div
        id="main-content"
        tabIndex={-1}
        className={`${styles.contentFrame} ${stability.stableContent}`}
      >
        {children}
      </div>
      <footer className={styles.footer}>{footer}</footer>
    </div>
  );
}
