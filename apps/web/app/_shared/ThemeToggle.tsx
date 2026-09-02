'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'fodip-theme';

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Manual light/dark override on top of the automatic prefers-color-scheme support already in
 * globals.css (axe A1). Persisted in localStorage and applied as a `data-theme` attribute on
 * <html> - matched by globals.css - rather than a class, so the same attribute the anti-FOUC
 * inline script in layout.tsx sets before hydration is exactly what this component then keeps in
 * sync with clicks, with no mismatch between the two.
 */
export default function ThemeToggle({ buttonClassName }: { buttonClassName: string }) {
  // null until mounted: avoids a hydration mismatch (the server has no notion of the visitor's
  // stored preference) and briefly rendering nothing is preferable to briefly rendering the
  // wrong icon.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch { /* private mode, storage disabled: fall back below */ }
    setTheme(stored === 'dark' || stored === 'light' ? stored : (systemPrefersDark() ? 'dark' : 'light'));
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* private mode, storage disabled: theme still applies for this page view */ }
  }

  if (!theme) return null;
  return (
    <button
      type="button"
      className={buttonClassName}
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
      title={theme === 'dark' ? 'Thème clair' : 'Thème sombre'}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
