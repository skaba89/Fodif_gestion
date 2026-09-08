export type PortalId =
  | 'entrepreneur'
  | 'agent'
  | 'comite'
  | 'direction'
  | 'administration'
  | 'auditeur'
  | 'partenaire';

export interface PortalAccessRule {
  loginHref: string;
  homeHref: string;
  allowedRoles: readonly string[];
}

export const PORTAL_ACCESS: Record<PortalId, PortalAccessRule> = {
  entrepreneur: {
    loginHref: '/entrepreneur/connexion',
    homeHref: '/entrepreneur',
    allowedRoles: ['PME'],
  },
  agent: {
    loginHref: '/agent/connexion',
    homeHref: '/agent/dossiers',
    allowedRoles: ['AGENT_FODIP', 'SUPER_ADMIN'],
  },
  comite: {
    loginHref: '/comite/connexion',
    homeHref: '/comite/dossiers',
    allowedRoles: ['COMITE_FINANCEMENT', 'SUPER_ADMIN'],
  },
  direction: {
    loginHref: '/direction/connexion',
    homeHref: '/direction/tableau-de-bord',
    allowedRoles: ['DIRECTION_FODIP', 'ANALYSTE', 'SUPER_ADMIN'],
  },
  administration: {
    loginHref: '/administration/connexion',
    homeHref: '/administration/utilisateurs',
    allowedRoles: ['SUPER_ADMIN'],
  },
  auditeur: {
    loginHref: '/auditeur/connexion',
    homeHref: '/auditeur/tableau-de-bord',
    allowedRoles: ['AUDITEUR', 'SUPER_ADMIN'],
  },
  partenaire: {
    loginHref: '/partenaire/connexion',
    homeHref: '/partenaire/financements',
    allowedRoles: ['PARTENAIRE_BANCAIRE'],
  },
};

const ROLE_HOME_PRIORITY: ReadonlyArray<readonly [string, string]> = [
  ['SUPER_ADMIN', PORTAL_ACCESS.administration.homeHref],
  ['DIRECTION_FODIP', PORTAL_ACCESS.direction.homeHref],
  ['ANALYSTE', PORTAL_ACCESS.direction.homeHref],
  ['AGENT_FODIP', PORTAL_ACCESS.agent.homeHref],
  ['COMITE_FINANCEMENT', PORTAL_ACCESS.comite.homeHref],
  ['AUDITEUR', PORTAL_ACCESS.auditeur.homeHref],
  ['PARTENAIRE_BANCAIRE', PORTAL_ACCESS.partenaire.homeHref],
  ['PME', PORTAL_ACCESS.entrepreneur.homeHref],
];

export function isPortalId(value: string | null | undefined): value is PortalId {
  return Boolean(value && Object.prototype.hasOwnProperty.call(PORTAL_ACCESS, value));
}

export function resolveRoleHome(roles: readonly string[]) {
  return ROLE_HOME_PRIORITY.find(([role]) => roles.includes(role))?.[1];
}

export function resolvePortalFromPath(pathname: string): PortalId | undefined {
  const segment = pathname.split('/').filter(Boolean)[0];
  return isPortalId(segment) ? segment : undefined;
}

export function rolesCanAccessPortal(roles: readonly string[], portal: PortalId) {
  return roles.some((role) => PORTAL_ACCESS[portal].allowedRoles.includes(role));
}
