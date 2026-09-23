import type { Metadata } from 'next';
import { Public_Sans } from 'next/font/google';
import ServiceWorkerRegistration from './_shared/ServiceWorkerRegistration';
import { ToastProvider } from './_shared/Toast';
import './globals.css';
import './fodip-official-theme.css';
import './_shared/business-workspaces.css';
import './fodip-product-theme.css';
import './institutional-typography.css';

// Public Sans is the single product typeface for body copy, navigation, headings and KPI values.
const publicSans = Public_Sans({
  subsets: ['latin'],
  variable: '--font-public-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FODIP Digital 2030',
  description: 'Plateforme nationale de financement, suivi et pilotage des PME guinéennes',
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
    { media: '(prefers-color-scheme: light)', color: '#14532D' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1710' },
  ],
};

const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('fodip-theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={publicSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ToastProvider>
          {children}
          <ServiceWorkerRegistration />
        </ToastProvider>
      </body>
    </html>
  );
}
