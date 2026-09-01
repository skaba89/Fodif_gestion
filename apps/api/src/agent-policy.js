'use strict';

const REVIEW_TRANSITIONS = Object.freeze({
  SOUMIS: ['EN_INSTRUCTION', 'COMPLEMENT_REQUIS'],
  EN_INSTRUCTION: ['COMPLEMENT_REQUIS', 'PRET_COMITE'],
  COMPLEMENT_REQUIS: ['EN_INSTRUCTION'],
});

function canClaimApplication(application) {
  return Boolean(application && ['SOUMIS', 'EN_INSTRUCTION', 'COMPLEMENT_REQUIS'].includes(application.statut));
}

function canReviewApplication(user, application, nextStatus) {
  if (!user?.sub || !application || application.agentResponsableId !== user.sub) return false;
  return (REVIEW_TRANSITIONS[application.statut] ?? []).includes(nextStatus);
}

function isReviewStatus(status) {
  return ['EN_INSTRUCTION', 'COMPLEMENT_REQUIS', 'PRET_COMITE'].includes(status);
}

module.exports = { REVIEW_TRANSITIONS, canClaimApplication, canReviewApplication, isReviewStatus };
