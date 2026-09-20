const CODE_LABELS: Record<string, string> = {
  BROUILLON: 'Brouillon',
  SOUMIS: 'Soumis',
  VALIDE: 'Validé',
  ACTIVE: 'Actif',
  CLOTURE: 'Clôturé',
  ARCHIVE: 'Archivé',
  ARCHIVEE: 'Archivée',
  PREVU: 'Prévu',
  EFFECTUE: 'Effectué',
  ANNULE: 'Annulé',
  A_VENIR: 'À venir',
  A_PAYER: 'À payer',
  EN_RETARD: 'En retard',
  PARTIEL: 'Partiellement payé',
  PARTIELLEMENT_PAYE: 'Partiellement payé',
  PAYE: 'Payé',
  EN_ATTENTE: 'En attente',
  VERIFIE: 'Vérifié',
  VALIDEE: 'Validée',
  REJETE: 'Rejeté',
  REJETEE: 'Rejetée',
  APPROUVE: 'Approuvé',
  ACTIF: 'Actif',
  DECAISSE: 'Décaissé',
  REMBOURSE: 'Remboursé',
  PLANIFIE: 'Planifié',
  EN_COURS: 'En cours',
  INSTRUCTION: 'En instruction',
  EXAMEN: 'En examen',
  PRET: 'Prêt',
  IMPAYE: 'Impayé',
  DEFAUT: 'Défaut',
  BLOQUE: 'Bloqué',
  SUSPENDU: 'Suspendu',
  A_VERIFIER: 'À vérifier',
  TERMINE: 'Terminé',
  ECHEC: 'Échec',
  CONFORME: 'Conforme',
  NON_CONFORME: 'Non conforme',
  RCCM: 'RCCM',
  NIF: 'NIF',
  BUSINESS_PLAN: 'Business plan',
  ETATS_FINANCIERS: 'États financiers',
  GARANTIE: 'Garantie',
  AUTRE: 'Autre',
  DEBIT: 'Débit',
  CREDIT: 'Crédit',
  A_RAPPROCHER: 'À rapprocher',
  RAPPROCHE: 'Rapproché',
  DECAISSEMENT: 'Décaissement',
  REMBOURSEMENT: 'Remboursement',
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super administrateur',
  AGENT_FODIP: 'Agent FODIP',
  PME: 'PME',
  PARTENAIRE_BANCAIRE: 'Partenaire bancaire',
  DIRECTION_FODIP: 'Direction FODIP',
  ANALYSTE: 'Analyste',
  COMITE_FINANCEMENT: 'Comité de financement',
  AUDITEUR: 'Auditeur',
};

function sentenceCase(value: string) {
  const normalized = value.replaceAll('_', ' ').trim().toLocaleLowerCase('fr-FR');
  return normalized ? normalized.replace(/^./, (letter) => letter.toLocaleUpperCase('fr-FR')) : '—';
}

export function humanizeCode(value?: string | null) {
  if (!value) return 'Non renseigné';
  return CODE_LABELS[value] ?? sentenceCase(value);
}

export function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? sentenceCase(role);
}
