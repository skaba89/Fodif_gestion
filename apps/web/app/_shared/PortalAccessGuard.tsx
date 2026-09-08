'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  PORTAL_ACCESS,
  resolveRoleHome,
  rolesCanAccessPortal,
  type PortalId,
} from '../../lib/portal-access';

const LAST_PORTAL_STORAGE_KEY = 'fodip:last-portal';

interface SessionContext {
  roles?: string[];
}

/**
 * Prevents portal pages from mounting before the current session has been checked against the
 * portal's role boundary. This matters because many pages start their business API calls on mount:
 * a wrong-role page must be redirected before those calls can race the session guard with a 403.
 *
 * This is navigation protection only. The API remains the authoritative RBAC enforcement layer.
 */
export default function PortalAccessGuard({
  portal,
  children,
}: {
  portal: PortalId;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const loginHref = PORTAL_ACCESS[portal].loginHref;
  const isLoginPage = pathname === loginHref;
  const [ready, setReady] = useState(isLoginPage);

  useEffect(() => {
    if (isLoginPage) {
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);

    fetch('/api/session/me', { cache: 'no-store' })
      .then(async (response) => {
        if (cancelled) return;

        if (response.status === 401) {
          window.location.replace(`${loginHref}?reason=session-expired`);
          return;
        }

        // A temporary session-endpoint/server outage must not masquerade as an authorization
        // decision. Let the mounted page expose its normal connectivity/error state instead.
        if (!response.ok) {
          setReady(true);
          return;
        }

        const session = (await response.json().catch(() => ({}))) as SessionContext;
        if (cancelled) return;
        const roles = session.roles ?? [];

        if (!rolesCanAccessPortal(roles, portal)) {
          window.location.replace(resolveRoleHome(roles) ?? '/');
          return;
        }

        try {
          window.sessionStorage.setItem(LAST_PORTAL_STORAGE_KEY, portal);
        } catch {
          // Browser privacy settings can disable storage. Portal-local routing still works from
          // the pathname, so persistence is only a convenience for global pages.
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoginPage, loginHref, portal]);

  if (isLoginPage || ready) return children;

  return (
    <div role="status" aria-live="polite" aria-busy="true">
      Vérification de la session sécurisée…
    </div>
  );
}
