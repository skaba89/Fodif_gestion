import AppShell from '../_shared/AppShell';
import { AccountMenu } from '../_shared/AccountMenu';

const navItems = [
  { label: 'Cockpit national', href: '/direction/tableau-de-bord' },
  { label: 'Financements', href: '/direction/financements' },
  { label: 'Rapprochement', href: '/direction/rapprochements' },
  { label: 'Notifications', href: '/notifications' },
  { label: 'Mes données', href: '/mes-donnees' },
];

export default function DirectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      portalLabel="Direction générale"
      homeHref="/direction/tableau-de-bord"
      navItems={navItems}
      accountMenu={<AccountMenu loginHref="/direction/connexion" loginLabel="Connexion Direction" />}
      footer="FODIP Digital 2030 · Pilotage national du portefeuille et de l’impact"
    >
      {children}
    </AppShell>
  );
}
