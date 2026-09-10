'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LOGIN_HREF,
  resolvePortalFromPath,
  resolveRoleHome,
  rolesCanAccessPortal,
} from '../../lib/portal-access';
import styles from './AccountMenu.module.css';

const SESSION_CHECK_INTERVAL_MS = 60_000;
const LAST_PORTAL_STORAGE_KEY = 'fodip:last-portal';

interface SessionContext {
  roles?: string[];
}

/**
 * Shared authenticated account controls and session guard for every portal.
 *
 * Privacy rule: account identifiers and roles are deliberately absent from the global shell.
 * Identity remains on the dedicated profile page; this control stores only the canonical home
 * resolved from the roles returned by the authenticated session.
 *
 * `loginHref` remains accepted temporarily so existing portal layouts stay source-compatible,
 * but every account now uses the single canonical /connexion entry point.
 */
export function AccountMenu({ loginLabel = 'Connexion' }: { loginHref?: string; loginLabel?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const loginHref = LOGIN_HREF;
  const [authenticated, setAuthenticated] = useState(false);
  const [accountHome, setAccountHome] = useState<string | null>(null);
  const intentionalLogout = useRef(false);
  const portal = resolvePortalFromPath(pathname);

  const redirectExpiredSession = useCallback(() => {
    if (intentionalLogout.current || pathname === loginHref) return;
    router.replace(`${loginHref}?reason=session-expired`);
    router.refresh();
  }, [loginHref, pathname, router]);

  const checkSession = useCallback(async () => {
    if (pathname === loginHref) {
      setAuthenticated(false);
      setAccountHome(null);
      return;
    }

    try {
      const response = await fetch('/api/session/me', { cache: 'no-store' });
      if (response.ok) {
        const session = (await response.json().catch(() => ({}))) as SessionContext;
        const roles = session.roles ?? [];
        const roleHome = resolveRoleHome(roles) ?? null;

        if (portal && !rolesCanAccessPortal(roles, portal)) {
          setAuthenticated(false);
          setAccountHome(roleHome);
          router.replace(roleHome ?? '/');
          router.refresh();
          return;
        }

        intentionalLogout.current = false;
        setAccountHome(roleHome);
        setAuthenticated(true);
        return;
      }

      setAuthenticated(false);
      setAccountHome(null);
      if (response.status === 401) redirectExpiredSession();
    } catch {
      // A network outage is not the same thing as an expired session. Keep the portal mounted and
      // let page-level error handling report connectivity problems instead of forcing logout.
      setAuthenticated(false);
      setAccountHome(null);
    }
  }, [pathname, loginHref, portal, redirectExpiredSession, router]);

  useEffect(() => {
    if (portal) window.sessionStorage.setItem(LAST_PORTAL_STORAGE_KEY, portal);

    if (pathname === loginHref) {
      setAuthenticated(false);
      setAccountHome(null);
      return;
    }

    void checkSession();
    const interval = window.setInterval(() => { void checkSession(); }, SESSION_CHECK_INTERVAL_MS);
    const onFocus = () => { void checkSession(); };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void checkSession();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [checkSession, loginHref, pathname, portal]);

  async function logout() {
    intentionalLogout.current = true;
    setAuthenticated(false);
    setAccountHome(null);
    await fetch('/api/session/logout', { method: 'POST' });
    router.replace(loginHref);
    router.refresh();
  }

  if (!authenticated) {
    return <Link className={styles.secondaryAction} href={loginHref}>{loginLabel}</Link>;
  }

  return (
    <div className={styles.actions} aria-label="Actions du compte">
      {accountHome && <Link className={styles.profileAction} href={accountHome}>Mon espace</Link>}
      <Link className={styles.profileAction} href="/assistance">Assistance</Link>
      <Link className={styles.profileAction} href="/profil">Mon profil</Link>
      <button className={styles.secondaryAction} type="button" onClick={logout}>Déconnexion</button>
    </div>
  );
}
