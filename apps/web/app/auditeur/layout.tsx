import AppShell from '../_shared/AppShell';
import { AccountMenu } from '../_shared/AccountMenu';
import PortalAccessGuard from '../_shared/PortalAccessGuard';

const navItems = [
  { label: 'Supervision', href: '/auditeur/tableau-de-bord' },
  { label: 'Mes données', href: '/mes-donnees' },
];

export default function AuditeurLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      portalLabel="Auditeur"
      homeHref="/auditeur/tableau-de-bord"
      navItems={navItems}
      accountMenu={<AccountMenu loginHref="/auditeur/connexion" loginLabel="Connexion auditeur" />}
      footer="FODIP Digital 2030 · Accès en lecture seule, intégralement journalisé"
    >
      <PortalAccessGuard portal="auditeur">{children}</PortalAccessGuard>
    </AppShell>
  );
}
