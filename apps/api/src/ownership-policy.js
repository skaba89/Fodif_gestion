'use strict';

const EDITABLE_DRAFT_STATUSES = Object.freeze(['BROUILLON']);
const SUBMITTABLE_STATUSES = Object.freeze(['BROUILLON']);

function ownsResource(ownedIds, resourceId) {
  if (!resourceId) return false;
  return new Set(Array.isArray(ownedIds) ? ownedIds : []).has(resourceId);
}

function canEditApplication(status) {
  return EDITABLE_DRAFT_STATUSES.includes(String(status || '').toUpperCase());
}

function canSubmitApplication(status) {
  return SUBMITTABLE_STATUSES.includes(String(status || '').toUpperCase());
}

function nextApplicationStatus(status, action) {
  const current = String(status || '').toUpperCase();
  const requestedAction = String(action || '').toUpperCase();
  if (requestedAction === 'SUBMIT' && canSubmitApplication(current)) return 'SOUMIS';
  return current;
}

module.exports = {
  EDITABLE_DRAFT_STATUSES,
  ownsResource,
  canEditApplication,
  canSubmitApplication,
  nextApplicationStatus,
};
