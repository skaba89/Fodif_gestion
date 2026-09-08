'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PORTAL_ACCESS,
  resolvePortalFromPath,
  resolveRoleHome,
  rolesCanAccessPortal,
} from '../../lib/portal-access';
import ThemeToggle from './ThemeToggle';
import Drawer from './Drawer';
import { ChevronRightIcon, MenuIcon } from './Icons';
import styles from './AppShell.module.css';
import stability from './AppShellStability.module.css';

export interface AppShellNavItem {
  label: string;
  href: string;
}

type SessionContext = {
  roles?: string[];
};

/**
 * Shared institutional shell for every authenticated portal.
 *
 * Navigation deliberately lives in one consistent hamburger drawer on desktop, tablet and mobile.
 * Account identifiers and role information never appear in this global chrome: those details are
 * reserved for the dedicated profile page.
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
  const [validatedPath, setValidatedPath] = useState<string | null>(null);

  const portal = useMemo(() => resolvePortalFromPath(pathname), [pathname]);
  const loginHref = portal ? PORTAL_ACCESS[portal].loginHref : undefined;
  const isLoginPage = Boolean(loginHref && pathname === loginHref);
  const portalContentReady = isLoginPage || validatedPath === pathname;

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

  useEffect(() => {
    // Login screens and non-portal routes must render immediately. Authenticated portal content,
    // however, is deliberately not mounted until the session has proved it belongs to this
    // portal. This prevents page-level API effects from racing the role-aware redirect with a
    // legacy local 401/403 redirect of their own.
    if (!portal || isLoginPage) {
      setValidatedPath(pathname);
      return;
    }

    let cancelled = false;
    setValidatedPath(null);

    fetch('/api/session/me', { cache: 'no-store' })
      .then(async (response) => {
        if (cancelled) return;
        if (response.status === 401) {
          window.location.replace(`${PORTAL_ACCESS[portal].loginHref}?reason=session-expired`);
          return;
        }
        if (!response.ok) {
          // A temporary upstream/session-check error is not proof of an expired session. Mount the
          // page and let its existing error state describe the connectivity/permission failure.
          setValidatedPath(pathname);
          return;
        }

        const session = (await response.json().catch(() => ({}))) as SessionContext;
        const roles = session.roles ?? [];
        if (!rolesCanAccessPortal(roles, portal)) {
          window.location.replace(resolveRoleHome(roles) ?? '/');
          return;
        }

        setValidatedPath(pathname);
      })
      .catch(() => {
        if (!cancelled) setValidatedPath(pathname);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoginPage, pathname, portal]);

  return (
    <div className={styles.shell} data-portal-context={portalLabel}>
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
            <span>Plateforme institutionnelle</span>
          </span>
        </Link>

        <div className={styles.headerContext} aria-hidden="true">
          <span className={styles.contextLabel}>Espace sécurisé</span>
          <span className={styles.contextDivider} />
          <span className={styles.contextPortal}>Session authentifiée</span>
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

      <Drawer open={drawerOpen} onClose={closeDrawer} title="Navigation principale" side="left">
        <div className={styles.drawerBrand}>
          <span className={styles.drawerMark} aria-hidden="true">FD</span>
          <div>
            <strong>FODIP DIGITAL</strong>
            <span>Plateforme institutionnelle</span>
          </div>
        </div>

        <div className={styles.drawerSectionHeader}>
          <span>Navigation principale</span>
          <span className={styles.drawerSectionRule} />
        </div>

        <nav className={styles.drawerNav} aria-label="Navigation principale">
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
        {portalContentReady ? children : (
          <div role="status" aria-live="polite">Vérification de la session sécurisée…</div>
        )}
      </div>
      <footer className={styles.footer}>{footer}</footer>
    </div>
  );
}
