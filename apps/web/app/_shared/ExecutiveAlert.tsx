import Link from 'next/link';
import { AlertTriangleIcon, InfoIcon } from './Icons';
import styles from './ExecutiveAlert.module.css';

export type AlertSeverity = 'critique' | 'attention' | 'info';

export interface ExecutiveAlertData {
  id: string;
  severite: AlertSeverity;
  titre: string;
  explication: string;
  dossiers: number;
  montant: number | null;
  action: string;
  lien: string;
}

const severityLabel: Record<AlertSeverity, string> = { critique: 'Critique', attention: 'Attention', info: 'À surveiller' };

function formatAmount(value: number): string {
  if (value >= 1_000_000_000) return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / 1_000_000_000)} Md GNF`;
  if (value >= 1_000_000) return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / 1_000_000)} M GNF`;
  return `${new Intl.NumberFormat('fr-FR').format(value)} GNF`;
}

/**
 * One "point d'attention" row - mission section 4: "chaque alerte doit avoir sévérité,
 * explication, nombre de dossiers concernés, montant concerné, action recommandée, lien vers les
 * dossiers concernés." Every field here comes straight from AnalyticsService.buildAlerts() - real
 * counts and amounts computed by real SQL (apps/api/src/analytics/analytics.repository.ts),
 * never a static placeholder list.
 */
export default function ExecutiveAlert({ alert }: { alert: ExecutiveAlertData }) {
  return (
    <li className={`${styles.row} ${styles[alert.severite]}`}>
      <span className={styles.icon} aria-hidden="true">
        {alert.severite === 'info' ? <InfoIcon /> : <AlertTriangleIcon />}
      </span>
      <div className={styles.body}>
        <div className={styles.headRow}>
          <strong>{alert.titre}</strong>
          <span className={styles.badge}>{severityLabel[alert.severite]}</span>
        </div>
        <p className={styles.explication}>{alert.explication}</p>
        <div className={styles.metaRow}>
          {alert.dossiers > 0 && <span>{alert.dossiers} dossier{alert.dossiers > 1 ? 's' : ''}</span>}
          {alert.montant !== null && <span>{formatAmount(alert.montant)}</span>}
        </div>
        <p className={styles.action}>{alert.action}</p>
      </div>
      <Link href={alert.lien} className={styles.link}>Voir les dossiers</Link>
    </li>
  );
}
