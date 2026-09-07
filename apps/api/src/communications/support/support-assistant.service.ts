import { Injectable } from '@nestjs/common';

export type SupportIntent =
  | 'SECURITY'
  | 'STATE_CHANGE'
  | 'ACCOUNT_SPECIFIC'
  | 'APPLICATION'
  | 'DOCUMENTS'
  | 'TRACKING'
  | 'PROGRAMS'
  | 'REPAYMENT'
  | 'WHATSAPP'
  | 'HUMAN_SUPPORT'
  | 'GENERAL';

export interface SupportAction {
  label: string;
  href: string;
}

export interface SupportAssistantResponse {
  intent: SupportIntent;
  answer: string;
  humanHandoff: boolean;
  actions: SupportAction[];
  safeguards: {
    accountDataDisclosed: false;
    stateChanged: false;
  };
}

interface TopicDefinition {
  intent: SupportIntent;
  keywords: string[];
  answer: string;
  humanHandoff?: boolean;
  actions?: SupportAction[];
}

const TOPICS: TopicDefinition[] = [
  {
    intent: 'DOCUMENTS',
    keywords: ['document', 'piece', 'justificatif', 'dossier complet', 'fichier'],
    answer:
      "Les pièces demandées dépendent du programme, de votre rôle et de l'étape du dossier. Consultez la liste affichée dans votre espace authentifié et déposez uniquement les documents demandés. N'envoyez pas de document d'identité, de coordonnées bancaires ou de secret de connexion dans ce chat.",
  },
  {
    intent: 'TRACKING',
    keywords: ['suivre', 'suivi', 'statut', 'avancement', 'ou en est', 'etat de'],
    answer:
      "Le suivi officiel d'un dossier se fait dans l'espace authentifié correspondant à votre rôle. L'assistant peut expliquer les statuts de manière générale, mais il ne lit ni ne révèle ici les données d'un dossier.",
  },
  {
    intent: 'APPLICATION',
    keywords: ['deposer', 'demande', 'candidature', 'soumettre', 'creer un dossier'],
    answer:
      "Pour déposer une demande en tant qu'entrepreneur, utilisez l'espace entrepreneur, complétez les informations requises, joignez les pièces demandées puis soumettez le dossier lorsque les contrôles sont satisfaits. L'assistant ne soumet jamais un dossier à votre place.",
    actions: [{ label: "Accéder à l'espace entrepreneur", href: '/entrepreneur' }],
  },
  {
    intent: 'PROGRAMS',
    keywords: ['programme', 'eligibilite', 'eligible', 'financement disponible', 'aide disponible'],
    answer:
      "Les critères d'éligibilité et les conditions de financement dépendent du programme actif. Vérifiez toujours la fiche officielle du programme concerné dans FODIP Digital avant de constituer une demande. L'assistant ne déclare pas une entreprise éligible et ne promet aucun financement.",
  },
  {
    intent: 'REPAYMENT',
    keywords: ['remboursement', 'echeance', 'retard', 'impaye', 'payer'],
    answer:
      "Pour les remboursements, fiez-vous aux échéances et informations validées dans votre espace sécurisé ou communiquées par les interlocuteurs autorisés. L'assistant ne modifie pas une échéance, ne confirme pas un paiement et ne demande jamais vos coordonnées bancaires dans ce chat.",
    humanHandoff: true,
  },
  {
    intent: 'WHATSAPP',
    keywords: ['whatsapp', 'relance', 'message mobile', 'notification whatsapp'],
    answer:
      "Les messages WhatsApp FODIP sont optionnels et nécessitent votre consentement. Ils servent aux rappels et informations autorisés. Ne transmettez jamais de mot de passe, code MFA, coordonnées bancaires ou document sensible par WhatsApp. Vous pouvez retirer votre consentement à tout moment depuis les paramètres prévus à cet effet.",
  },
  {
    intent: 'HUMAN_SUPPORT',
    keywords: ['agent', 'humain', 'support', 'assistance', 'contact', 'conseiller'],
    answer:
      "Si votre question nécessite l'examen d'un dossier, d'une pièce, d'une situation financière ou d'un incident de compte, demandez l'intervention d'un agent FODIP via le canal de support institutionnel indiqué dans votre espace. Ne partagez pas de secret de connexion dans votre demande de support.",
    humanHandoff: true,
  },
];

const SECURITY_KEYWORDS = [
  'mot de passe',
  'password',
  'code mfa',
  'otp',
  'code de connexion',
  'token',
  'secret',
  'cle api',
  'api key',
];

const STATE_CHANGE_KEYWORDS = [
  'approuve',
  'approuver',
  'rejette',
  'rejeter',
  'debloque',
  'debloquer',
  'decaisse',
  'decaisser',
  'supprime',
  'supprimer',
  'modifie mon',
  'modifier mon',
  'change mon',
  'changer mon',
  'valide mon',
  'valider mon',
];

const ACCOUNT_SPECIFIC_KEYWORDS = [
  'mon dossier',
  'ma demande',
  'mon financement',
  'mon remboursement',
  'mon compte',
  'mes documents',
  'ma piece',
  'mes informations',
];

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(question: string, keywords: string[]): boolean {
  return keywords.some((keyword) => question.includes(normalize(keyword)));
}

@Injectable()
export class SupportAssistantService {
  answer(rawQuestion: string): SupportAssistantResponse {
    const question = normalize(rawQuestion);

    if (includesAny(question, STATE_CHANGE_KEYWORDS)) {
      return this.response(
        'STATE_CHANGE',
        "Je peux expliquer une procédure, mais je ne peux ni approuver, rejeter, modifier, supprimer, décaisser ou valider une opération. Toute décision ou modification métier doit passer par les écrans autorisés, les contrôles RBAC et, lorsqu'ils s'appliquent, les validations institutionnelles.",
        true,
      );
    }

    if (includesAny(question, SECURITY_KEYWORDS)) {
      return this.response(
        'SECURITY',
        "Ne communiquez jamais votre mot de passe, code MFA, jeton ou autre secret. L'assistant ne vous demandera jamais ces informations. Pour un problème d'accès, utilisez les mécanismes sécurisés de votre compte ou demandez l'aide d'un agent FODIP.",
        true,
        [{ label: 'Ouvrir Mon profil', href: '/profil' }],
      );
    }

    if (includesAny(question, ACCOUNT_SPECIFIC_KEYWORDS)) {
      return this.response(
        'ACCOUNT_SPECIFIC',
        "Pour protéger vos données, je ne révèle pas ici le contenu d'un dossier, d'un financement, d'un document ou d'un compte. Consultez l'espace authentifié correspondant à votre rôle. Si une analyse humaine est nécessaire, contactez un agent FODIP depuis le canal institutionnel prévu.",
        true,
      );
    }

    const topic = TOPICS
      .map((candidate) => ({
        candidate,
        score: candidate.keywords.filter((keyword) => question.includes(normalize(keyword))).length,
      }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score)[0]?.candidate;

    if (topic) {
      return this.response(
        topic.intent,
        topic.answer,
        topic.humanHandoff ?? false,
        topic.actions ?? [],
      );
    }

    return this.response(
      'GENERAL',
      "Je peux vous guider sur les démarches FODIP, les documents, le suivi d'un dossier, les programmes, les remboursements, WhatsApp et l'orientation vers un agent. Pour une décision métier ou une information propre à un dossier, utilisez votre espace sécurisé ou demandez un accompagnement humain.",
      true,
    );
  }

  private response(
    intent: SupportIntent,
    answer: string,
    humanHandoff: boolean,
    actions: SupportAction[] = [],
  ): SupportAssistantResponse {
    return {
      intent,
      answer,
      humanHandoff,
      actions,
      safeguards: {
        accountDataDisclosed: false,
        stateChanged: false,
      },
    };
  }
}
