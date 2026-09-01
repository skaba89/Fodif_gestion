export const EDITABLE_DRAFT_STATUSES: readonly string[];
export function ownsResource(ownedIds: string[] | null | undefined, resourceId: string | null | undefined): boolean;
export function canEditApplication(status: string | null | undefined): boolean;
export function canSubmitApplication(status: string | null | undefined): boolean;
export function nextApplicationStatus(status: string | null | undefined, action: string): string;
