'use strict';

const EDITABLE_APPLICATION_STATUSES = new Set(['BROUILLON', 'COMPLEMENT_REQUIS']);

function requireEnterpriseScope(user) {
  return Boolean(user && typeof user.entrepriseId === 'string' && user.entrepriseId.length > 0);
}

function canAccessEnterprise(user, entrepriseId) {
  if (!requireEnterpriseScope(user)) return false;
  return user.entrepriseId === entrepriseId;
}

function canEditApplication(user, application) {
  if (!application || !canAccessEnterprise(user, application.entrepriseId)) return false;
  return EDITABLE_APPLICATION_STATUSES.has(application.statut);
}

function canSubmitApplication(user, application) {
  return Boolean(application && canAccessEnterprise(user, application.entrepriseId) && application.statut === 'BROUILLON');
}

function normalizeCompanyPatch(input) {
  const allowed = [
    'raisonSociale', 'nomCommercial', 'rccm', 'nif', 'formeJuridique', 'dateCreation',
    'descriptionActivite', 'nombreEmployes', 'chiffreAffairesAnnuel', 'telephone', 'email',
    'siteWeb', 'regionId', 'prefectureId', 'communeId', 'adresse',
  ];
  return Object.fromEntries(Object.entries(input || {}).filter(([key, value]) => allowed.includes(key) && value !== undefined));
}

module.exports = {
  EDITABLE_APPLICATION_STATUSES,
  requireEnterpriseScope,
  canAccessEnterprise,
  canEditApplication,
  canSubmitApplication,
  normalizeCompanyPatch,
};
