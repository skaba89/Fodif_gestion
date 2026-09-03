/**
 * Mission "présentation Directeur général" (section 5, design premium) explicitly rules out
 * emoji as icons ("éviter emojis comme icônes... utiliser des icônes SVG cohérentes"). One small,
 * dependency-free set of inline SVGs - `currentColor`-stroked so every icon inherits whatever text
 * color its container already sets (readable in both themes without a separate dark-mode variant)
 * - covers every icon this mission's new components need, rather than pulling in an icon library
 * for a dozen glyphs.
 */
type IconProps = { className?: string; 'aria-hidden'?: boolean };

const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function MenuIcon(props: IconProps) {
  return <svg {...base} {...props}><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></svg>;
}

export function CloseIcon(props: IconProps) {
  return <svg {...base} {...props}><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>;
}

export function ChevronRightIcon(props: IconProps) {
  return <svg {...base} {...props}><polyline points="9 6 15 12 9 18" /></svg>;
}

export function AlertTriangleIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
}

export function InfoIcon(props: IconProps) {
  return <svg {...base} {...props}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>;
}

export function TrendUpIcon(props: IconProps) {
  return <svg {...base} {...props}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>;
}

export function TrendDownIcon(props: IconProps) {
  return <svg {...base} {...props}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" /></svg>;
}

export function TrendFlatIcon(props: IconProps) {
  return <svg {...base} {...props}><line x1="2" y1="12" x2="22" y2="12" /></svg>;
}

export function RefreshIcon(props: IconProps) {
  return <svg {...base} {...props}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>;
}

export function DownloadIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>;
}
