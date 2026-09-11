'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  INTENTIONAL_LOGOUT_EVENT,
  PORTAL_ACCESS,
  resolvePortalFromPath,
  resolveRoleHome,
  rolesCanAccessPortal,
} from '../../lib/portal-access';
import ThemeToggle from './ThemeToggle';
import Drawer from './Drawer';
import FodipOfficialBrand from './FodipOfficialBrand';
import ConnectivityBanner from './ConnectivityBanner';
import { ChevronRightIcon, MenuIcon } from './Icons';
import styles from './AppShellInstitutional.module.css';
import stability from './AppShellStability.module.css';

export interface AppShellNavItem {
  label: string;
  href: string;
}

type SessionContext = {
  roles?: string[];
};

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
}

function BellIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>;
}

function isNavigationItemActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === '/') return false;
  return pathname.startsWith(`${href}/`);
}

/**
 * Shared institutional shell for every authenticated portal.
 * The API stays authoritative for RBAC. The shell only structures role-aware navigation,
 * connectivity feedback and responsive presentation around already-authorized content.
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
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [sessionValidationFailed, setSessionValidationFailed] = useState(false);
  const [validatedPath, setValidatedPath] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [online, setOnline] = useState(true);
  const intentionalLogout = useRef(false);

  const portal = useMemo(() => resolvePortalFromPath(pathname), [pathname]);
  const isLoginPage = pathname === '/connexion' || Boolean(portal && pathname.endsWith('/connexion'));
  const portalContentReady = isLoginPage || validatedPath === pathname;

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const searchResults = useMemo(() => {
    const normalized = searchQuery.trim().toLocaleLowerCase('fr-FR');
    if (!normalized) return [];
    return navItems
      .filter((item) => item.label.toLocaleLowerCase('fr-FR').includes(normalized))
      .slice(0, 5);
  }, [navItems, searchQuery]);

  const mobileNavItems = useMemo(() => {
    if (navItems.length <= 4) return navItems;
    const selected: AppShellNavItem[] = [];
    const add = (item?: AppShellNavItem) => {
      if (item && !selected.some((candidate) => candidate.href === item.href) && selected.length < 4) selected.push(item);
    };
    add(navItems[0]);
    add(navItems.find((item) => /(dossier|suivi|instruction)/i.test(item.label)));
    add(navItems.find((item) => /(nouvelle|opération|décision|portefeuille)/i.test(item.label)));
    navItems.forEach(add);
    return selected.slice(0, 4);
  }, [navItems]);

  const notificationsHref = navItems.find((item) => /notification/i.test(item.label))?.href ?? '/notifications';

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const target = searchResults[0];
    if (!target) return;
    setSearchQuery('');
    router.push(target.href);
  }

  useEffect(() => {
    const onIntentionalLogout = () => { intentionalLogout.current = true; };
    window.addEventListener(INTENTIONAL_LOGOUT_EVENT, onIntentionalLogout);
    return () => window.removeEventListener(INTENTIONAL_LOGOUT_EVENT, onIntentionalLogout);
  }, []);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/config', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data?.demoMode) setDemoMode(true); })
      .catch(() => { /* Configuration must never block access to the shell. */ });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get('reason');
    setSessionExpired(reason === 'session-expired');
    setDrawerOpen(false);
    setSearchQuery('');
  }, [pathname]);

  useEffect(() => {
    if (!portal || isLoginPage) {
      setSessionValidationFailed(false);
      setValidatedPath(pathname);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setSessionValidationFailed(false);
    setValidatedPath(null);

    const redirectToLogin = () => {
      const destination = intentionalLogout.current
        ? PORTAL_ACCESS[portal].loginHref
        : `${PORTAL_ACCESS[portal].loginHref}?reason=session-expired`;
      window.location.replace(destination);
    };

    fetch('/api/session/me', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (cancelled) return;
        if (response.status === 401) {
          redirectToLogin();
          return;
        }
        if (!response.ok) {
          setSessionValidationFailed(true);
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
      .catch((error: unknown) => {
        if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) return;
        setSessionValidationFailed(true);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isLoginPage, pathname, portal]);

  return (
    <div className={styles.shell} data-portal-context={portalLabel}>
      <a href="#main-content" className="skip-link">Aller au contenu principal</a>
      {demoMode ? <div className={styles.demoBanner} role="status">Données de démonstration — aucune donnée réelle</div> : null}

      <aside className={styles.sidebar} aria-label={`Navigation ${portalLabel}`}>
        <Link href={homeHref} className={styles.sidebarBrand} aria-label={`FODIP — ${portalLabel} — accueil`}>
          <FodipOfficialBrand subtitle="FODIP Digital 2030" compact />
        </Link>
        <div className={styles.portalContext}>
          <span>Espace sécurisé</span>
          <strong>{portalLabel}</strong>
        </div>
        <nav className={styles.nav} aria-label={`Navigation principale ${portalLabel}`}>
          {navItems.map((item) => {
            const active = isNavigationItemActive(pathname, item.href);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={active ? styles.navItemActive : styles.navItem}>
                <span className={styles.navDot} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className={styles.sidebarMeta}>
          <div className={styles.secureStatus}><span className={styles.secureDot} aria-hidden="true" />Session sécurisée et tracée</div>
          <div className={styles.sidebarAccount}>{accountMenu}</div>
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <Link href={homeHref} className={styles.mobileBrand} aria-label={`FODIP — ${portalLabel} — accueil`}>
            <FodipOfficialBrand subtitle={portalLabel} compact />
          </Link>

          <form className={styles.quickSearch} role="search" onSubmit={submitSearch}>
            <SearchIcon />
            <label className="sr-only" htmlFor="workspace-search">Recherche rapide</label>
            <input
              id="workspace-search"
              type="search"
              autoComplete="off"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Rechercher une page dans cet espace…"
            />
            {searchResults.length > 0 ? (
              <div className={styles.searchResults} aria-label="Résultats de navigation">
                {searchResults.map((item) => (
                  <Link key={item.href} href={item.href} className={styles.searchResult} onClick={() => setSearchQuery('')}>
                    <span>{item.label}</span><small>Ouvrir</small>
                  </Link>
                ))}
              </div>
            ) : null}
          </form>

          <div className={styles.topbarActions}>
            <span className={`${styles.connectionStatus} ${online ? '' : styles.connectionOffline}`} role="status">
              <span className={styles.connectionDot} aria-hidden="true" /><span>{online ? 'En ligne' : 'Hors ligne'}</span>
            </span>
            <Link className={styles.iconButton} href={notificationsHref} aria-label="Notifications"><BellIcon /></Link>
            <ThemeToggle buttonClassName={styles.themeToggle} />
            <button type="button" className={styles.menuButton} aria-label="Ouvrir le menu principal" aria-haspopup="dialog" aria-expanded={drawerOpen} onClick={openDrawer}>
              <MenuIcon aria-hidden />
            </button>
          </div>
        </header>

        <ConnectivityBanner />
        {sessionExpired ? <div className={styles.notice} role="alert" data-testid="session-expired-notice">Votre session a expiré pour des raisons de sécurité. Reconnectez-vous pour continuer.</div> : null}

        <div id="main-content" tabIndex={-1} className={`${styles.contentFrame} ${stability.stableContent}`}>
          {portalContentReady ? children : sessionValidationFailed ? (
            <div role="alert" className={styles.notice}>Impossible de vérifier la session sécurisée. Vérifiez votre connexion puis rechargez la page.</div>
          ) : (
            <div role="status" aria-live="polite" className={styles.notice}>Vérification de la session sécurisée…</div>
          )}
        </div>
        <footer className={styles.footer}>{footer}</footer>
      </div>

      <nav className={styles.bottomNav} aria-label={`Navigation mobile ${portalLabel}`}>
        {mobileNavItems.map((item) => {
          const active = isNavigationItemActive(pathname, item.href);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={active ? styles.bottomItemActive : styles.bottomItem}>
              <span className={styles.bottomIcon} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button type="button" className={styles.bottomMore} aria-label="Plus de navigation" onClick={openDrawer}><MenuIcon aria-hidden /><span>Plus</span></button>
      </nav>

      <Drawer open={drawerOpen} onClose={closeDrawer} title="Navigation principale" side="left">
        <div className={styles.drawerBrand}><FodipOfficialBrand subtitle={portalLabel} /></div>
        <nav className={styles.drawerNav} aria-label={`Toutes les rubriques ${portalLabel}`}>
          {navItems.map((item) => {
            const active = isNavigationItemActive(pathname, item.href);
            return (
              <Link key={item.href} href={item.href} onClick={closeDrawer} aria-current={active ? 'page' : undefined} className={active ? styles.drawerNavItemActive : styles.drawerNavItem}>
                <span>{item.label}</span><ChevronRightIcon className={styles.drawerNavChevron} aria-hidden />
              </Link>
            );
          })}
        </nav>
        <div className={styles.drawerAccount}>{accountMenu}</div>
      </Drawer>
    </div>
  );
}
