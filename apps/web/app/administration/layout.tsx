import AppShell from '../_shared/AppShell';
import { AccountMenu } from '../_shared/AccountMenu';

const navItems = [
  { label: 'Utilisateurs et rôles', href: '/administration/utilisateurs' },
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
      {children}
    </AppShell>
  );
}
