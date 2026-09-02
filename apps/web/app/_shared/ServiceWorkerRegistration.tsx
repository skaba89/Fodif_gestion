'use client';

import { useEffect } from 'react';

// Axe D2 (docs/14-ROADMAP-SAAS-PREMIUM.md). Registers public/sw.js once per session, from every
// portal (mounted in the root layout) - not per-page, since the offline shell has to be ready
// however the visitor first arrives. Renders nothing; failures (unsupported browser, blocked by
// an extension) are swallowed on purpose, the app must work identically without a service
// worker, just without the offline fallback.
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return null;
}
