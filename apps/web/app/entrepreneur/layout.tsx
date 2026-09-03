import AppShell from '../_shared/AppShell';
import { AccountMenu } from '../_shared/AccountMenu';

const navItems = [
  { label: 'Accueil', href: '/entrepreneur' },
  { label: 'Mon entreprise', href: '/entrepreneur/entreprise' },
  { label: 'Nouvelle demande', href: '/entrepreneur/demande' },
  { label: 'Mes dossiers', href: '/entrepreneur/suivi' },
  { label: 'Notifications', href: '/notifications' },
  { label: 'Mes données', href: '/mes-donnees' },
];

export default function EntrepreneurLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      portalLabel="Espace PME"
      homeHref="/entrepreneur"
      navItems={navItems}
      accountMenu={<AccountMenu loginHref="/entrepreneur/connexion" />}
      footer="FODIP Digital 2030 · Portail PME sécurisé"
    >
      {children}
    </AppShell>
  );
}
