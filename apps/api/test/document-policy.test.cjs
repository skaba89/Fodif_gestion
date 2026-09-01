const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_DOCUMENT_BYTES,
  detectFileType,
  validateDocumentFile,
  canUploadDocument,
  isAllowedDocumentType,
} = require('../src/document-policy.js');

const pdf = Buffer.from('%PDF-1.7\nsecure document');
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

test('detects file type from bytes rather than filename', () => {
  assert.deepEqual(detectFileType(pdf), { mimeType: 'application/pdf', extension: 'pdf' });
  assert.deepEqual(detectFileType(png), { mimeType: 'image/png', extension: 'png' });
  assert.equal(detectFileType(Buffer.from('malware')), null);
});

test('rejects a forged MIME type', () => {
  assert.deepEqual(
    validateDocumentFile({ buffer: pdf, size: pdf.length, mimetype: 'image/png' }),
    { valid: false, reason: 'MIME_SIGNATURE_MISMATCH' },
  );
});

test('rejects empty and oversized files', () => {
  assert.equal(validateDocumentFile({ buffer: Buffer.alloc(0), size: 0, mimetype: 'application/pdf' }).reason, 'EMPTY_FILE');
  assert.equal(
    validateDocumentFile({ buffer: pdf, size: MAX_DOCUMENT_BYTES + 1, mimetype: 'application/pdf' }).reason,
    'FILE_TOO_LARGE',
  );
});

test('accepts only controlled business document types', () => {
  assert.equal(isAllowedDocumentType('RCCM'), true);
  assert.equal(isAllowedDocumentType('EXECUTABLE'), false);
});

test('upload requires both ownership and an editable application status', () => {
  const user = { entrepriseId: 'ent-a' };
  assert.equal(canUploadDocument(user, { entrepriseId: 'ent-a', statut: 'BROUILLON' }), true);
  assert.equal(canUploadDocument(user, { entrepriseId: 'ent-b', statut: 'BROUILLON' }), false);
  assert.equal(canUploadDocument(user, { entrepriseId: 'ent-a', statut: 'SOUMIS' }), false);
});
