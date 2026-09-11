import styles from './InstitutionalIllustration.module.css';

export type InstitutionalIllustrationVariant = 'empty-dossiers' | 'pme-onboarding' | 'network-error';

const TITLES: Record<InstitutionalIllustrationVariant, string> = {
  'empty-dossiers': 'Illustration géométrique pour une liste de dossiers vide',
  'pme-onboarding': 'Illustration géométrique pour l’onboarding PME',
  'network-error': 'Illustration géométrique pour une erreur réseau',
};

function TextilePattern() {
  return (
    <g className={styles.pattern} aria-hidden="true">
      <path className={styles.lineSoft} d="M42 58 82 18l40 40-40 40Z" />
      <path className={styles.lineSoft} d="M302 44 338 8l36 36-36 36Z" />
      <path className={styles.lineSoft} d="M318 190 356 152l38 38-38 38Z" />
      <path className={styles.lineSoft} d="M24 196 58 162l34 34-34 34Z" />
      <path className={styles.lineSoft} d="M196 18c52 0 94 42 94 94s-42 94-94 94-94-42-94-94 42-94 94-94Z" />
      <path className={styles.lineSoft} d="M196 38c41 0 74 33 74 74s-33 74-74 74-74-33-74-74 33-74 74-74Z" />
    </g>
  );
}

export default function InstitutionalIllustration({
  variant,
  className = '',
}: {
  variant: InstitutionalIllustrationVariant;
  className?: string;
}) {
  return (
    <figure className={`${styles.frame} ${className}`} role="img" aria-label={TITLES[variant]}>
      <svg viewBox="0 0 420 250" fill="none" xmlns="http://www.w3.org/2000/svg">
        <title>{TITLES[variant]}</title>
        <TextilePattern />

        {variant === 'empty-dossiers' ? (
          <g>
            <rect className={styles.primary} x="118" y="74" width="184" height="118" rx="18" />
            <path className={styles.gold} d="M148 102h124v12H148z" />
            <path className={styles.ivory} d="M148 130h88v8h-88zM148 150h106v8H148z" opacity="0.88" />
            <path className={styles.primarySoft} d="M138 64h58l16 20h-74z" />
            <path className={styles.line} d="M162 182h96" />
            <path className={styles.line} d="m286 170 18 12-18 12" />
          </g>
        ) : null}

        {variant === 'pme-onboarding' ? (
          <g>
            <path className={styles.primary} d="M120 174c0-40 32-72 72-72h40c40 0 72 32 72 72v22H120z" />
            <circle className={styles.gold} cx="212" cy="84" r="34" />
            <path className={styles.ivory} d="M197 82h30v7h-30zM208.5 70h7v30h-7z" />
            <path className={styles.line} d="M102 194h220" />
            <path className={styles.lineSoft} d="m90 102 28 28-28 28-28-28Z" />
            <path className={styles.lineSoft} d="m334 92 24 24-24 24-24-24Z" />
          </g>
        ) : null}

        {variant === 'network-error' ? (
          <g>
            <circle className={styles.primary} cx="210" cy="132" r="70" />
            <path className={styles.ivory} d="M158 126c29-29 75-29 104 0l-10 10c-24-23-61-23-84 0zm22 22c17-17 44-17 61 0l-10 10c-11-11-29-11-41 0zm19 20c6-6 16-6 22 0l-11 11z" />
            <path className={styles.gold} d="m149 78 14-14 108 108-14 14z" />
            <path className={styles.lineSoft} d="m78 142 30 30-30 30-30-30Z" />
            <path className={styles.lineSoft} d="m344 46 26 26-26 26-26-26Z" />
          </g>
        ) : null}
      </svg>
    </figure>
  );
}
