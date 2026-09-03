import AppShell from '../_shared/AppShell';
import { AccountMenu } from '../_shared/AccountMenu';

const navItems = [
  { label: 'Dossiers', href: '/agent/dossiers' },
  { label: 'Notifications', href: '/notifications' },
  { label: 'Mes données', href: '/mes-donnees' },
];

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      portalLabel="Espace Agent"
      homeHref="/agent/dossiers"
      navItems={navItems}
      accountMenu={<AccountMenu loginHref="/agent/connexion" loginLabel="Connexion agent" />}
      footer="FODIP Digital 2030 · Instruction sécurisée des dossiers"
    >
      {children}
    </AppShell>
  );
}
