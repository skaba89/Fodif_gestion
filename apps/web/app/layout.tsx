import type { Metadata } from 'next';
import { Public_Sans } from 'next/font/google';
import './globals.css';

// Public Sans is the typeface behind the U.S. Web Design System — a deliberate choice for a
// state-grade platform: built for long-form reading and dense data tables, distinct from
// generic SaaS defaults (Inter, system-ui), and self-hosted here (no third-party request at
// runtime, no dependency on an external CDN being reachable from a government network).
const publicSans = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-public-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FODIP Digital 2030',
  description: 'Plateforme nationale de financement, suivi et pilotage des PME guinéennes',
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0f6b45' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1712' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={publicSans.variable}>
      <body>{children}</body>
    </html>
  );
}
