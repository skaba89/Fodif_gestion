'use strict';

const PRIVILEGED_ROLES = Object.freeze([
  'SUPER_ADMIN', 'DIRECTION_FODIP', 'AGENT_FODIP', 'ANALYSTE',
  'COMITE_FINANCEMENT', 'AUDITEUR',
]);

function normalizeRoleCodes(roles) {
  return [...new Set((Array.isArray(roles) ? roles : [])
    .filter((role) => typeof role === 'string')
    .map((role) => role.trim().toUpperCase())
    .filter(Boolean))].sort();
}

function validateUserScope(roles, entrepriseId, partenaireBancaireId) {
  const normalized = normalizeRoleCodes(roles);
  if (normalized.length === 0) return 'At least one role is required';
  if (normalized.includes('PME') && !entrepriseId) return 'PME_ENTERPRISE_SCOPE_REQUIRED';
  if (normalized.includes('PARTENAIRE_BANCAIRE') && !partenaireBancaireId) return 'PARTENAIRE_BANK_SCOPE_REQUIRED';
  return null;
}

function requiresMfa(roles) {
  const normalized = new Set(normalizeRoleCodes(roles));
  return PRIVILEGED_ROLES.some((role) => normalized.has(role));
}

function canDeactivateUser(actorId, targetId, targetRoles, activeSuperAdmins) {
  if (actorId === targetId) return false;
  return !normalizeRoleCodes(targetRoles).includes('SUPER_ADMIN') || activeSuperAdmins > 1;
}

module.exports = { PRIVILEGED_ROLES, normalizeRoleCodes, validateUserScope, requiresMfa, canDeactivateUser };

