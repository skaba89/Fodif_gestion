import AppShell from '../_shared/AppShell';
import { AccountMenu } from '../_shared/AccountMenu';

const navItems = [
  { label: 'Séance décisionnelle', href: '/comite/dossiers' },
  { label: 'Programmes', href: '/comite/programmes' },
  { label: 'Notifications', href: '/notifications' },
  { label: 'Mes données', href: '/mes-donnees' },
];

export default function CommitteeLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      portalLabel="Comité de financement"
      homeHref="/comite/dossiers"
      navItems={navItems}
      accountMenu={<AccountMenu loginHref="/connexion" loginLabel="Connexion" />}
      footer="FODIP Digital 2030 · Décisions humaines, motivées et auditées"
    >
      {children}
    </AppShell>
  );
}
