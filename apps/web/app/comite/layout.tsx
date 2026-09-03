import AppShell from '../_shared/AppShell';
import { AccountMenu } from '../_shared/AccountMenu';

const navItems = [
  { label: 'Séance décisionnelle', href: '/comite/dossiers' },
  { label: 'Notifications', href: '/notifications' },
  { label: 'Mes données', href: '/mes-donnees' },
];

export default function CommitteeLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      portalLabel="Comité de financement"
      homeHref="/comite/dossiers"
      navItems={navItems}
      accountMenu={<AccountMenu loginHref="/comite/connexion" loginLabel="Connexion comité" />}
      footer="FODIP Digital 2030 · Décisions humaines, motivées et auditées"
    >
      {children}
    </AppShell>
  );
}
