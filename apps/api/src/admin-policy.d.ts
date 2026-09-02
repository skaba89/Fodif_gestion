export const PRIVILEGED_ROLES: readonly string[];
export function normalizeRoleCodes(roles: unknown): string[];
export function validateUserScope(roles: unknown, entrepriseId?: string | null): string | null;
export function requiresMfa(roles: unknown): boolean;
export function canDeactivateUser(actorId: string, targetId: string, targetRoles: unknown, activeSuperAdmins: number): boolean;

