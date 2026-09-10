import AppShell from '../_shared/AppShell';
import { AccountMenu } from '../_shared/AccountMenu';

const navItems = [
  { label: 'Supervision', href: '/auditeur/tableau-de-bord' },
  { label: 'Programmes', href: '/auditeur/programmes' },
  { label: 'Mes données', href: '/mes-donnees' },
];

export default function AuditeurLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      portalLabel="Auditeur"
      homeHref="/auditeur/tableau-de-bord"
      navItems={navItems}
      accountMenu={<AccountMenu loginHref="/connexion" loginLabel="Connexion" />}
      footer="FODIP Digital 2030 · Accès en lecture seule, intégralement journalisé"
    >
      {children}
    </AppShell>
  );
}
