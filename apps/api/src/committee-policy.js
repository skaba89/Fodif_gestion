'use strict';

const DECISIONS = ['APPROUVE', 'REJETE', 'COMPLEMENT_REQUIS'];

function nextStatusForDecision(decision) {
  if (!DECISIONS.includes(decision)) throw new Error('Unsupported committee decision');
  return decision;
}

function validateCommitteeDecision(input, montantDemande) {
  if (!input || !DECISIONS.includes(input.decision)) return 'Unsupported committee decision';
  const comment = typeof input.commentaire === 'string' ? input.commentaire.trim() : '';
  if (input.decision !== 'APPROUVE' && comment.length < 3) return 'A motivated comment is required';
  if (input.decision === 'APPROUVE') {
    const amount = Number(input.montantApprouve);
    const duration = Number(input.dureeMois);
    if (!(amount > 0) || amount > Number(montantDemande)) return 'Approved amount must be positive and cannot exceed the requested amount';
    if (!Number.isInteger(duration) || duration < 1 || duration > 120) return 'Duration must be between 1 and 120 months';
    const rate = input.tauxInteret == null ? 0 : Number(input.tauxInteret);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return 'Interest rate must be between 0 and 100';
    const grace = input.differeMois == null ? 0 : Number(input.differeMois);
    if (!Number.isInteger(grace) || grace < 0 || grace > duration) return 'Grace period cannot exceed the financing duration';
  }
  return null;
}

module.exports = { DECISIONS, nextStatusForDecision, validateCommitteeDecision };
