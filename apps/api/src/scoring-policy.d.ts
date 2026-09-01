export interface ScoringCriterion { id: string; code: string; poids: number | string; scoreMax: number | string }
export interface ScoringAnswer { code: string; scoreObtenu: number; commentaire?: string }
export interface ScoreResult {
  scoreTotal: number;
  niveauRisque: 'FAIBLE' | 'MODERE' | 'ELEVE';
  recommandation: 'FAVORABLE' | 'FAVORABLE_SOUS_CONDITIONS' | 'DEFAVORABLE';
  details: Array<{ critereId: string; code: string; scoreObtenu: number; contribution: number; commentaire: string }>;
}
export function calculateScore(criteria: ScoringCriterion[], answers: ScoringAnswer[]): ScoreResult;
export function classifyScore(score: number): Pick<ScoreResult, 'niveauRisque' | 'recommandation'>;
export function canScoreApplication(user: { sub: string }, application: { statut: string; agentResponsableId?: string | null }): boolean;
