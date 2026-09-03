'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
// Deliberately still reaching into entrepreneur/ for styles rather than relocating
// portal.module.css into _shared/: every one of the six portal layouts this component replaces
// already imports that same file the same way, and moving it is a separate, higher-risk change
// (every layout.tsx, connexion page and portal page across six portals would need its import path
// updated) that mission "présentation Directeur général" doesn't require to fix the duplication
// this component actually targets - the six near-identical *AccountMenu.tsx components, not where
// the stylesheet physically lives.
import styles from '../entrepreneur/portal.module.css';

type Session = { email: string };

/**
 * Mission "présentation Directeur général" (section 7, "mutualiser les menus utilisateur
 * actuellement dupliqués"): replaces AccountMenu/AgentAccountMenu/CommitteeAccountMenu/
 * AdministrationAccountMenu/AuditeurAccountMenu/PartenaireAccountMenu - six components that were
 * byte-for-byte identical except for the login route they redirect to when logged out.
 */
export function AccountMenu({ loginHref, loginLabel = 'Connexion' }: { loginHref: string; loginLabel?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);

  // Re-check on every navigation within the portal, not just on mount: this component stays
  // mounted across the connexion -> dashboard transition (same layout), so a mount-only fetch
  // would keep showing "logged out" right after a successful login.
  useEffect(() => {
    fetch('/api/session/me', { cache: 'no-store' })
      .then(async (response) => (response.ok ? response.json() : null))
      .then(setSession)
      .catch(() => setSession(null));
  }, [pathname]);

  async function logout() {
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
