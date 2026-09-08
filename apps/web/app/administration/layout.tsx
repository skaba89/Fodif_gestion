import AppShell from '../_shared/AppShell';
import { AccountMenu } from '../_shared/AccountMenu';
import PortalAccessGuard from '../_shared/PortalAccessGuard';

const navItems = [
  { label: 'Utilisateurs et rôles', href: '/administration/utilisateurs' },
  { label: 'Récupération comptes', href: '/administration/recuperation' },
  { label: 'Notifications', href: '/notifications' },
  { label: 'Mes données', href: '/mes-donnees' },
];

export default function AdministrationLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      portalLabel="Administration"
      homeHref="/administration/utilisateurs"
      navItems={navItems}
      accountMenu={<AccountMenu loginHref="/administration/connexion" loginLabel="Connexion administration" />}
      footer="FODIP Digital 2030 · Administration auditée"
    >
      <PortalAccessGuard portal="administration">{children}</PortalAccessGuard>
    </AppShell>
  );
}
