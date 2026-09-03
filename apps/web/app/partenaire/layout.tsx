import AppShell from '../_shared/AppShell';
import { AccountMenu } from '../_shared/AccountMenu';

const navItems = [
  { label: 'Portefeuille', href: '/partenaire/financements' },
  { label: 'Mes données', href: '/mes-donnees' },
];

export default function PartenaireLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      portalLabel="Partenaire bancaire"
      homeHref="/partenaire/financements"
      navItems={navItems}
      accountMenu={<AccountMenu loginHref="/partenaire/connexion" loginLabel="Connexion partenaire" />}
      footer="FODIP Digital 2030 · Accès strictement limité à votre périmètre, intégralement journalisé"
    >
      {children}
    </AppShell>
  );
}
