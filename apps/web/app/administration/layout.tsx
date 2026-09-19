import AppShell from '../_shared/AppShell';
import { AccountMenu } from '../_shared/AccountMenu';

const navItems = [
  { label: 'Tableau de bord', href: '/administration/tableau-de-bord' },
  { label: 'Utilisateurs et rôles', href: '/administration/utilisateurs' },
  { label: 'Récupération comptes', href: '/administration/recuperation' },
  { label: 'Journal', href: '/administration/journal' },
  { label: 'Notifications', href: '/notifications' },
  { label: 'Mes données', href: '/mes-donnees' },
];

export default function AdministrationLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      portalLabel="Administration"
      homeHref="/administration/tableau-de-bord"
      navItems={navItems}
      accountMenu={<AccountMenu loginHref="/administration/connexion" loginLabel="Connexion administration" />}
      footer="FODIP Digital 2030 · Administration auditée"
    >
      {children}
    </AppShell>
  );
}
