'use strict';

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function classifyScore(score) {
  if (score >= 75) return { niveauRisque: 'FAIBLE', recommandation: 'FAVORABLE' };
  if (score >= 50) return { niveauRisque: 'MODERE', recommandation: 'FAVORABLE_SOUS_CONDITIONS' };
  return { niveauRisque: 'ELEVE', recommandation: 'DEFAVORABLE' };
}

function calculateScore(criteria, answers) {
  if (!Array.isArray(criteria) || criteria.length === 0) throw new Error('Active scoring model has no criteria');
  if (!Array.isArray(answers) || answers.length !== criteria.length) throw new Error('Every scoring criterion must be answered');

  const answerByCode = new Map();
  for (const answer of answers) {
    if (!answer || typeof answer.code !== 'string' || answerByCode.has(answer.code)) throw new Error('Scoring criterion codes must be unique');
    answerByCode.set(answer.code, answer);
  }

  const totalWeight = criteria.reduce((sum, criterion) => sum + Number(criterion.poids), 0);
  if (!(totalWeight > 0)) throw new Error('Scoring model weight must be positive');

  const details = criteria.map((criterion) => {
    const answer = answerByCode.get(criterion.code);
    if (!answer) throw new Error(`Missing scoring criterion: ${criterion.code}`);
    const scoreMax = Number(criterion.scoreMax);
    const scoreObtenu = Number(answer.scoreObtenu);
    if (!Number.isFinite(scoreObtenu) || scoreObtenu < 0 || scoreObtenu > scoreMax) {
      throw new Error(`Score outside allowed range for criterion: ${criterion.code}`);
    }
    const contribution = (scoreObtenu / scoreMax) * Number(criterion.poids) / totalWeight * 100;
    return {
      critereId: criterion.id,
      code: criterion.code,
      scoreObtenu: round(scoreObtenu),
      contribution: round(contribution, 4),
      commentaire: typeof answer.commentaire === 'string' ? answer.commentaire.trim() : '',
    };
  });

  const scoreTotal = round(details.reduce((sum, detail) => sum + detail.contribution, 0));
  return { scoreTotal, ...classifyScore(scoreTotal), details };
}

function canScoreApplication(user, application) {
  return Boolean(user && application && application.statut === 'EN_INSTRUCTION' && application.agentResponsableId === user.sub);
}

module.exports = { calculateScore, canScoreApplication, classifyScore };
