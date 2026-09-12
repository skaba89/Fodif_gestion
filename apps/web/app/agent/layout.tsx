import AppShell from '../_shared/AppShell';
import { AccountMenu } from '../_shared/AccountMenu';

const navItems = [
  { label: 'Tableau de bord', href: '/agent/tableau-de-bord' },
  { label: 'Dossiers', href: '/agent/dossiers' },
  { label: 'Programmes', href: '/agent/programmes' },
  { label: 'Notifications', href: '/notifications' },
  { label: 'Mes données', href: '/mes-donnees' },
];

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      portalLabel="Espace Agent"
      homeHref="/agent/tableau-de-bord"
      navItems={navItems}
      accountMenu={<AccountMenu loginHref="/connexion" loginLabel="Connexion" />}
      footer="FODIP Digital 2030 · Instruction sécurisée des dossiers"
    >
      {children}
    </AppShell>
  );
}
