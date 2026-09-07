'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import ThemeToggle from './ThemeToggle';
import Drawer from './Drawer';
import { ChevronRightIcon, MenuIcon } from './Icons';
import styles from './AppShell.module.css';
import stability from './AppShellStability.module.css';

export interface AppShellNavItem {
  label: string;
  href: string;
}

/**
 * Shared institutional shell for every authenticated portal.
 *
 * Navigation deliberately lives in one consistent hamburger drawer on desktop, tablet and mobile.
 * That keeps dense role-specific portals visually calm while preserving keyboard, focus and route
 * semantics through the reusable Drawer component.
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

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/config', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data?.demoMode) setDemoMode(true); })
      .catch(() => { /* Config must never block access to the portal shell. */ });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get('reason');
    setSessionExpired(reason === 'session-expired');
    setDrawerOpen(false);
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
          <span className={styles.brandText}>
            <strong>FODIP DIGITAL</strong>
            <span>{portalLabel}</span>
          </span>
        </Link>

        <div className={styles.headerContext} aria-hidden="true">
          <span className={styles.contextLabel}>Espace sécurisé</span>
          <span className={styles.contextDivider} />
          <span className={styles.contextPortal}>{portalLabel}</span>
        </div>

        <div className={styles.headerActions}>
          <ThemeToggle buttonClassName={styles.themeToggle} />
          <span className={styles.accountDesktop}>{accountMenu}</span>
          <button
            type="button"
            className={styles.hamburger}
            aria-label="Ouvrir le menu principal"
            aria-haspopup="dialog"
            aria-expanded={drawerOpen}
            onClick={openDrawer}
          >
            <MenuIcon aria-hidden />
            <span className={styles.menuLabel}>Menu</span>
          </button>
        </div>
      </header>

      {sessionExpired && (
        <div className={styles.notice} role="alert" data-testid="session-expired-notice">
          Votre session a expiré pour des raisons de sécurité. Reconnectez-vous pour continuer.
        </div>
      )}

      <Drawer open={drawerOpen} onClose={closeDrawer} title={`Navigation ${portalLabel}`} side="left">
        <div className={styles.drawerBrand}>
          <span className={styles.drawerMark} aria-hidden="true">FD</span>
          <div>
            <strong>FODIP DIGITAL</strong>
            <span>{portalLabel}</span>
          </div>
        </div>

        <div className={styles.drawerSectionHeader}>
          <span>Navigation principale</span>
          <span className={styles.drawerSectionRule} />
        </div>

        <nav className={styles.drawerNav} aria-label={`Navigation ${portalLabel}`}>
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeDrawer}
                aria-current={active ? 'page' : undefined}
                className={active ? styles.drawerNavItemActive : styles.drawerNavItem}
              >
                <span className={styles.drawerNavLabel}>{item.label}</span>
                <ChevronRightIcon className={styles.drawerNavChevron} aria-hidden />
              </Link>
            );
          })}
        </nav>

        <div className={styles.drawerAccount}>
          <span className={styles.drawerAccountLabel}>Compte et sécurité</span>
          {accountMenu}
        </div>

        <div className={styles.drawerMeta}>
          <strong>FODIP Digital 2030</strong>
          <span>Navigation institutionnelle sécurisée</span>
        </div>
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
