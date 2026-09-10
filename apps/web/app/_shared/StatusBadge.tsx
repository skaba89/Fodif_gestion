import { dossierStatusLabel, dossierStatusTone } from './dossierStatus';
import styles from './StatusBadge.module.css';

export type StatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export function humanizeCode(value?: string | null): string {
  if (!value) return 'Non renseigné';
  return value
    .trim()
    .replace(/[_-]+/g, ' ')
    .toLocaleLowerCase('fr-FR')
    .replace(/^./, (letter) => letter.toLocaleUpperCase('fr-FR'));
}

export function getGenericStatusTone(value?: string | null): StatusTone {
  const normalized = (value ?? '').trim().toLocaleUpperCase('fr-FR');
  if (!normalized) return 'neutral';

  if (/(REJETE|ANNULE|ECHEC|DEFAUT|BLOQUE)/.test(normalized)) return 'danger';
  if (/(RETARD|IMPAYE|COMPLEMENT|ATTENTE|SUSPENDU|A_VERIFIER)/.test(normalized)) return 'warning';
  if (/(APPROUVE|ACTIF|ACTIVE|PAYE|REMBOURSE|DECAISSE|CLOTURE|TERMINE)/.test(normalized)) return 'success';
  if (/(SOUMIS|INSTRUCTION|EXAMEN|PRET|PLANIFIE|EN_COURS)/.test(normalized)) return 'info';
  return 'neutral';
}

export default function StatusBadge({
  label,
  tone = 'neutral',
  title,
}: {
  label: string;
  tone?: StatusTone;
  title?: string;
}) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`} title={title}>
      <span className={styles.dot} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function DossierStatusBadge({ status }: { status?: string | null }) {
  const normalized = status ?? '';
  return (
    <StatusBadge
      label={normalized ? dossierStatusLabel(normalized) : 'Non renseigné'}
      tone={dossierStatusTone(normalized)}
      title={normalized || undefined}
    />
  );
}

export function GenericStatusBadge({ status }: { status?: string | null }) {
  return (
    <StatusBadge
      label={humanizeCode(status)}
      tone={getGenericStatusTone(status)}
      title={status || undefined}
    />
  );
}

export function RiskBadge({ level }: { level?: string | null }) {
  const normalized = (level ?? '').trim().toLocaleUpperCase('fr-FR');
  const tone: StatusTone = normalized === 'FAIBLE'
    ? 'success'
    : normalized === 'MOYEN' || normalized === 'MOYENNE'
      ? 'warning'
      : normalized === 'ELEVE' || normalized === 'ÉLEVÉ' || normalized === 'ELEVEE' || normalized === 'ÉLEVÉE'
        ? 'danger'
        : 'neutral';

  return <StatusBadge label={humanizeCode(level)} tone={tone} title={level || undefined} />;
}
