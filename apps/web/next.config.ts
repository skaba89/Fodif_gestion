import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Axe D2 (docs/14-ROADMAP-SAAS-PREMIUM.md). Browsers already re-validate a registered
        // service worker script on essentially every navigation regardless of caching headers,
        // but an intermediary (a corporate proxy, a CDN placed in front of this app later) may
        // not know that convention - an explicit no-cache here removes any doubt that a
        // pushed sw.js update reaches visitors promptly instead of being served stale.
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
    ];
  },
};

export default nextConfig;
