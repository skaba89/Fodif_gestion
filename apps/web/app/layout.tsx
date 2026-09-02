import type { Metadata } from 'next';
import { Public_Sans } from 'next/font/google';
import ServiceWorkerRegistration from './_shared/ServiceWorkerRegistration';
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
  // Axe D2 (docs/14-ROADMAP-SAAS-PREMIUM.md) - installable PWA. manifest/icons here (rather
  // than hand-written <link> tags) so Next emits the correct <head> entries itself.
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0f6b45' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1712' },
  ],
};

// Applies a persisted manual theme choice (axe A4) before first paint, so the page never flashes
// the wrong theme then corrects itself. Deliberately a plain inline script rather than a
// useEffect in _shared/ThemeToggle.tsx: that would only run after React hydrates, well after the
// initial (unstyled-for-dark-mode) paint. Reads localStorage directly - no cookie round trip, no
// server involvement - and does nothing (falls through to the prefers-color-scheme media query
// in globals.css) when nothing was ever chosen.
const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('fodip-theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // suppressHydrationWarning: the inline script below sets data-theme on this element before
  // React hydrates, which is an expected, intentional mismatch with the server-rendered markup
  // (the server has no notion of the visitor's stored preference) - the canonical pattern for
  // this kind of pre-hydration theme script.
  return (
    <html lang="fr" className={publicSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
