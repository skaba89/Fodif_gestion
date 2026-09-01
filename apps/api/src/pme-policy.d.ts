export interface EnterpriseScopedUser { entrepriseId?: string | null }
export interface ScopedApplication { entrepriseId: string; statut: string }
export const EDITABLE_APPLICATION_STATUSES: Set<string>;
export function requireEnterpriseScope(user: EnterpriseScopedUser | null | undefined): boolean;
export function canAccessEnterprise(user: EnterpriseScopedUser | null | undefined, entrepriseId: string): boolean;
export function canEditApplication(user: EnterpriseScopedUser | null | undefined, application: ScopedApplication | null | undefined): boolean;
export function canSubmitApplication(user: EnterpriseScopedUser | null | undefined, application: ScopedApplication | null | undefined): boolean;
export function normalizeCompanyPatch(input: Record<string, unknown>): Record<string, unknown>;
