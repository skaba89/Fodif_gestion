import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FODIP Digital 2030',
  description: 'Plateforme nationale de financement, suivi et pilotage des PME guinéennes',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
