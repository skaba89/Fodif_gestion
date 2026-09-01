export const REVIEW_TRANSITIONS: Readonly<Record<string, readonly string[]>>;
export function canClaimApplication(application: { statut?: string } | null): boolean;
export function canReviewApplication(
  user: { sub?: string },
  application: { statut?: string; agentResponsableId?: string | null } | null,
  nextStatus: string,
): boolean;
export function isReviewStatus(status: string): boolean;
