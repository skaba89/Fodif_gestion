'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from '../entrepreneur/portal.module.css';

type Session = { email: string };

const SESSION_CHECK_INTERVAL_MS = 60_000;

/**
 * Shared authenticated account menu and session guard for every portal.
 *
 * A short-lived access token is intentional. When it expires, protected pages must not stay
 * mounted and keep firing 401 responses: this component redirects the user to the login page
 * of the current portal, while preserving the distinction between an expired session and an
 * intentional logout.
 */
export function AccountMenu({ loginHref, loginLabel = 'Connexion' }: { loginHref: string; loginLabel?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const intentionalLogout = useRef(false);

  const redirectExpiredSession = useCallback(() => {
    if (intentionalLogout.current || pathname === loginHref) return;
    router.replace(`${loginHref}?reason=session-expired`);
    router.refresh();
  }, [loginHref, pathname, router]);

  const checkSession = useCallback(async () => {
    if (pathname === loginHref) {
      setSession(null);
      return;
    }

    try {
      const response = await fetch('/api/session/me', { cache: 'no-store' });
      if (response.ok) {
        // A successful session after a voluntary logout means the user logged in again while the
        // shared layout stayed mounted. Re-arm expiry handling for that new authenticated session.
        intentionalLogout.current = false;
        setSession(await response.json());
        return;
      }

      setSession(null);
      if (response.status === 401) redirectExpiredSession();
    } catch {
      // A network outage is not the same thing as an expired session. Keep the portal mounted and
      // let the page-level error handling report connectivity problems instead of forcing logout.
      setSession(null);
    }
  }, [pathname, loginHref, redirectExpiredSession]);

  // Re-check on navigation, periodically while the portal stays open, and whenever the user comes
  // back to the tab/window. This covers the common case where the 15-minute access token expires
  // while the user is reading or filling a form without navigating.
  useEffect(() => {
    if (pathname === loginHref) {
      setSession(null);
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
  }, [checkSession, loginHref, pathname]);

  async function logout() {
    intentionalLogout.current = true;
    setSession(null);
    await fetch('/api/session/logout', { method: 'POST' });
    router.replace(loginHref);
    router.refresh();
  }

  if (!session) return <Link className={styles.secondary} href={loginHref}>{loginLabel}</Link>;
  return (
    <div className={styles.account}>
      <span>{session.email}</span>
      <button className={styles.secondary} type="button" onClick={logout}>Déconnexion</button>
    </div>
  );
}
