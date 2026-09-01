export const MAX_DOCUMENT_BYTES: number;
export const ALLOWED_DOCUMENT_TYPES: readonly string[];
export function detectFileType(buffer: Buffer): { mimeType: string; extension: string } | null;
export function validateDocumentFile(file: { buffer: Buffer; size: number; mimetype: string }):
  | { valid: false; reason: string }
  | { valid: true; mimeType: string; extension: string };
export function canUploadDocument(
  user: { entrepriseId?: string | null },
  application: { entrepriseId?: string | null; statut?: string },
): boolean;
export function isAllowedDocumentType(type: string): boolean;
