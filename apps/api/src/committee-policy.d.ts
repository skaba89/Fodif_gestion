export type CommitteeDecision = 'APPROUVE' | 'REJETE' | 'COMPLEMENT_REQUIS';
export interface CommitteeDecisionInput {
  decision: CommitteeDecision;
  montantApprouve?: number;
  tauxInteret?: number;
  dureeMois?: number;
  differeMois?: number;
  garanties?: string;
  conditions?: string;
  commentaire?: string;
}
export const DECISIONS: CommitteeDecision[];
export function nextStatusForDecision(decision: string): CommitteeDecision;
export function validateCommitteeDecision(input: CommitteeDecisionInput, montantDemande: number | string): string | null;
