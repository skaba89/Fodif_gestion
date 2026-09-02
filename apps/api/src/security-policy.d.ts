export interface PasswordPolicyResult {
  valid: boolean;
  failures: string[];
}

export function evaluatePassword(password: string): PasswordPolicyResult;
export function hasAllPermissions(granted: string[], required: string[]): boolean;
export function hasAnyRole(granted: string[], required: string[]): boolean;
export function resolveJwtSecret(secret: string | undefined, environment: string | undefined): string;
export function parseDurationSeconds(value: string | number | undefined, fallbackSeconds?: number): number;
export function deriveSecret(baseSecret: string, context: string): Buffer;
export function encryptWithKey(plaintext: string, key: Buffer): string;
export function decryptWithKey(payload: string, key: Buffer): string;
