'use strict';

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = Object.freeze([
  'RCCM',
  'NIF',
  'BUSINESS_PLAN',
  'ETATS_FINANCIERS',
  'GARANTIE',
  'AUTRE',
]);
const EDITABLE_APPLICATION_STATUSES = new Set(['BROUILLON', 'COMPLEMENT_REQUIS']);

function detectFileType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return { mimeType: 'application/pdf', extension: 'pdf' };
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mimeType: 'image/jpeg', extension: 'jpg' };
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mimeType: 'image/png', extension: 'png' };
  }
  return null;
}

function validateDocumentFile(file) {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    return { valid: false, reason: 'EMPTY_FILE' };
  }
  if (file.buffer.length > MAX_DOCUMENT_BYTES || file.size > MAX_DOCUMENT_BYTES) {
    return { valid: false, reason: 'FILE_TOO_LARGE' };
  }
  const detected = detectFileType(file.buffer);
  if (!detected) return { valid: false, reason: 'UNSUPPORTED_FILE_SIGNATURE' };
  if (file.mimetype !== detected.mimeType) return { valid: false, reason: 'MIME_SIGNATURE_MISMATCH' };
  return { valid: true, ...detected };
}

function canUploadDocument(user, application) {
  return Boolean(
    user?.entrepriseId &&
    application?.entrepriseId === user.entrepriseId &&
    EDITABLE_APPLICATION_STATUSES.has(application.statut),
  );
}

function isAllowedDocumentType(type) {
  return ALLOWED_DOCUMENT_TYPES.includes(type);
}

module.exports = {
  MAX_DOCUMENT_BYTES,
  ALLOWED_DOCUMENT_TYPES,
  detectFileType,
  validateDocumentFile,
  canUploadDocument,
  isAllowedDocumentType,
};
