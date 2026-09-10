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
import FodipOfficialBrand from './FodipOfficialBrand';
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

function isNavigationItemActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === '/') return false;
  return pathname.startsWith(`${href}/`);
}

/**
 * Shared institutional shell for every authenticated portal.
 *
 * The API remains the RBAC authority. Before portal children mount, this shell verifies the
 * current session and redirects a valid account that opened the wrong portal to its canonical
 * role home. Navigation is role-scoped by each portal layout and nested routes keep their parent
 * menu entry active so users never lose context while reviewing a detail page.
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
  // Legacy portal login routes still live below each protected portal layout so old bookmarks can
  // redirect to the single /connexion page. Let those tiny redirect pages render before the
  // session guard runs; otherwise AppShell can observe their legacy pathname first and incorrectly
  // turn a normal unauthenticated visit into /connexion?reason=session-expired.
  const isLoginPage = pathname === '/connexion' || Boolean(portal && pathname.endsWith('/connexion'));
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
          // A temporary upstream failure is not proof that the session expired. Keep the existing
          // page-level connectivity handling instead of weakening or bypassing server-side RBAC.
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
        <Link href={homeHref} className={styles.brand} aria-label={`FODIP — ${portalLabel} — accueil`}>
          <FodipOfficialBrand subtitle="Plateforme institutionnelle" compact />
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

      <Drawer open={drawerOpen} onClose={closeDrawer} title="Navigation principale" side="left">
        <div className={styles.drawerBrand}>
          <FodipOfficialBrand subtitle={portalLabel} />
        </div>

        <div className={styles.drawerSectionHeader}>
          <span>Navigation principale</span>
          <span className={styles.drawerSectionRule} />
        </div>

        <nav className={styles.drawerNav} aria-label={`Navigation ${portalLabel}`}>
          {navItems.map((item) => {
            const active = isNavigationItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeDrawer}
                aria-current={active ? 'page' : undefined}
                className={active ? styles.drawerNavItemActive : styles.drawerNavItem}
                style={{ transitionProperty: 'border-color, transform' }}
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
          <span>Navigation institutionnelle sécurisée · accès limité au périmètre du compte</span>
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
