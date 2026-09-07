/**
 * Shared dossier status vocabulary for the PME-facing portal.
 *
 * `direction/tableau-de-bord/page.tsx` already keeps its own `statusLabels` map for the
 * institutional cockpit; this one is scoped to what an entrepreneur needs to see and adds the
 * severity `tone` used to color-code the status pill (portal.module.css `.pill--{tone}`), so a
 * dossier that's approved reads as positive and one that's rejected reads as a problem instead of
 * every status sharing the same neutral/amber pill regardless of where it sits in the workflow.
 */

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const DOSSIER_STATUS_LABELS: Record<string, string> = {
  BROUILLON: 'Brouillon',
  SOUMIS: 'Soumis',
  EN_INSTRUCTION: 'En instruction',
  COMPLEMENT_REQUIS: 'Complément requis',
  PRET_COMITE: 'Prêt pour le comité',
  APPROUVE: 'Approuvé',
  REJETE: 'Rejeté',
  ANNULE: 'Annulé',
  CLOTURE: 'Clôturé',
};

const DOSSIER_STATUS_TONE: Record<string, StatusTone> = {
  BROUILLON: 'neutral',
  SOUMIS: 'info',
  EN_INSTRUCTION: 'info',
  COMPLEMENT_REQUIS: 'warning',
  PRET_COMITE: 'warning',
  APPROUVE: 'success',
  REJETE: 'danger',
  ANNULE: 'neutral',
  CLOTURE: 'neutral',
};

/** Ordered workflow stages used to compute an approximate "progress" percentage for a dossier. */
export const DOSSIER_STAGE_ORDER = [
  'BROUILLON',
  'SOUMIS',
  'EN_INSTRUCTION',
  'COMPLEMENT_REQUIS',
  'PRET_COMITE',
  'APPROUVE',
  'CLOTURE',
];

export function dossierStatusLabel(status: string): string {
  return DOSSIER_STATUS_LABELS[status] ?? status;
}

export function dossierStatusTone(status: string): StatusTone {
  return DOSSIER_STATUS_TONE[status] ?? 'neutral';
}

/** Rough completion percentage through the workflow, for active dashboard progress. Terminal
 * outcomes are not selected as the lead active dossier by the dashboard. */
export function dossierProgressPercent(status: string): number {
  const index = DOSSIER_STAGE_ORDER.indexOf(status);
  if (index === -1) return 0;
  return Math.round((index / (DOSSIER_STAGE_ORDER.length - 1)) * 100);
}
