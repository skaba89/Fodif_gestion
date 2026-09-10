'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { resolveRoleHome } from '../../lib/portal-access';
import styles from '../entrepreneur/portal.module.css';
import FodipOfficialBrand from './FodipOfficialBrand';
import premium from './LoginForm.module.css';

type Step = 'credentials' | 'setup' | 'verify';
type OidcPortal = 'connexion' | 'agent' | 'comite' | 'direction' | 'administration' | 'auditeur';

interface SessionResponse {
  message?: string;
  mfaSetupRequired?: boolean;
  mfaRequired?: boolean;
  mfaChallenge?: string;
  secret?: string;
  user?: { roles?: string[] };
}

interface ExistingSessionResponse {
  roles?: string[];
}

export interface LoginFormProps {
  eyebrow: string;
  title: string;
  lead: string;
  /** Explicit destination kept for legacy callers. Omit to route from the authenticated roles. */
  redirectTo?: string;
  /** Roles allowed to use this portal. Omit to accept any authenticated account. */
  allowedRoles?: string[];
  deniedMessage?: string;
  /** A recognized account that used the wrong portal is sent to its canonical role home. */
  redirectWrongRoleToHome?: boolean;
  /** 'narrow' renders a single centered card; 'wide' is the default authentication layout. */
  variant?: 'wide' | 'narrow';
  replaceHistory?: boolean;
  /** Offers SSO for institutional accounts when OIDC is configured on the API. */
  oidcPortal?: OidcPortal;
}

/**
 * Shared login flow for every account type.
 *
 * The backend remains authoritative for authentication, MFA and RBAC. The canonical /connexion
 * page does not ask the user to choose a role: after authentication, the roles returned by the
 * API determine the authorized home. Existing portal-specific props remain supported only for
 * backward-compatible callers while legacy URLs redirect to /connexion.
 */
export default function LoginForm(props: LoginFormProps) {
  return (
    <Suspense fallback={<main className={premium.main} />}>
      <LoginFormInner {...props} />
    </Suspense>
  );
}

function LoginFormInner({
  eyebrow,
  title,
  lead,
  redirectTo,
  allowedRoles,
  deniedMessage,
  redirectWrongRoleToHome = true,
  variant = 'wide',
  replaceHistory = false,
  oidcPortal,
}: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oidcToken = searchParams.get('oidc_token');
  const sessionExpired = searchParams.get('reason') === 'session-expired';
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(() => Boolean(oidcToken));
  const [checkingSession, setCheckingSession] = useState(() => !oidcToken);
  const [existingSessionHome, setExistingSessionHome] = useState<string | null>(null);

  async function postJson(path: string, body: unknown): Promise<SessionResponse> {
    const response = await fetch(path, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as SessionResponse;
    if (!response.ok) throw new Error(data.message ?? 'Connexion impossible');
    return data;
  }

  async function finalizeSession(data: SessionResponse) {
    const roles = data.user?.roles ?? [];
    if (allowedRoles && !roles.some((role) => allowedRoles.includes(role))) {
      const roleHome = redirectWrongRoleToHome ? resolveRoleHome(roles) : undefined;
      if (roleHome) {
        router.replace(roleHome);
        router.refresh();
        return;
      }
      await fetch('/api/session/logout', { method: 'POST' });
      throw new Error(deniedMessage ?? 'Ce compte ne possède pas les droits nécessaires.');
    }

    const destination = redirectTo ?? resolveRoleHome(roles);
    if (!destination) {
      await fetch('/api/session/logout', { method: 'POST' });
      throw new Error('Aucun espace FODIP n’est autorisé pour ce compte.');
    }

    if (replaceHistory) router.replace(destination); else router.push(destination);
    router.refresh();
  }

  async function switchAccount() {
    setLoading(true);
    setError('');
    try {
      await fetch('/api/session/logout', { method: 'POST' });
      setExistingSessionHome(null);
      setEmail('');
      setPassword('');
      setCode('');
      setStep('credentials');
    } catch {
      setError('Impossible de fermer la session actuelle. Réessayez.');
    } finally {
      setLoading(false);
    }
  }

  async function submitCredentials(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await postJson('/api/session/login', { email, password });
      if (data.mfaSetupRequired && data.mfaChallenge && data.secret) {
        setChallenge(data.mfaChallenge);
        setSecret(data.secret);
        setCode('');
        setStep('setup');
        return;
      }
      if (data.mfaRequired && data.mfaChallenge) {
        setChallenge(data.mfaChallenge);
        setCode('');
        setStep('verify');
        return;
      }
      await finalizeSession(data);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Connexion impossible');
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(event: FormEvent, endpoint: 'confirm' | 'verify') {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await postJson(`/api/session/mfa/${endpoint}`, { mfaChallenge: challenge, code });
      await finalizeSession(data);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Code invalide');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (oidcToken) {
      postJson('/api/session/oidc/finish', { token: oidcToken })
        .then(async (data) => {
          if (data.mfaSetupRequired && data.mfaChallenge && data.secret) {
            setChallenge(data.mfaChallenge);
            setSecret(data.secret);
            setStep('setup');
            return;
          }
          if (data.mfaRequired && data.mfaChallenge) {
            setChallenge(data.mfaChallenge);
            setStep('verify');
            return;
          }
          await finalizeSession(data);
        })
        .catch((exception) => setError(exception instanceof Error ? exception.message : 'Connexion impossible'))
        .finally(() => setLoading(false));
      return;
    }

    const oidcError = searchParams.get('oidc_error');
    if (oidcError === 'account_not_found') {
      setError('Aucun compte institutionnel actif ne correspond à cette identité. Utilisez votre mot de passe ou contactez un administrateur.');
    } else if (oidcError) {
      setError('La connexion via le fournisseur d’identité a échoué. Réessayez, ou utilisez votre mot de passe.');
    }

    fetch('/api/session/me', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return;
        const session = (await response.json().catch(() => ({}))) as ExistingSessionResponse;
        setExistingSessionHome(resolveRoleHome(session.roles ?? []) ?? null);
      })
      .catch(() => undefined)
      .finally(() => setCheckingSession(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cardClassName = `${premium.card} ${variant === 'narrow' ? '' : styles.section}`;

  return (
    <main className={premium.main}>
      <div className={premium.header}>
        <FodipOfficialBrand subtitle="Connexion sécurisée" />
        <p className={premium.eyebrow}>{eyebrow}</p>
        <h1 className={premium.title}>{title}</h1>
        <p className={premium.lead}>{lead}</p>
      </div>

      {sessionExpired && (
        <div className={cardClassName} role="status" data-testid="session-expired-notice">
          <p className={premium.sessionTitle}>Votre session a expiré.</p>
          <p className={premium.lead}>Reconnectez-vous pour continuer dans l’espace autorisé pour votre compte.</p>
        </div>
      )}

      {checkingSession && (
        <div className={cardClassName} role="status" aria-live="polite">
          <p className={premium.sessionTitle}>Vérification de la session sécurisée…</p>
        </div>
      )}

      {!checkingSession && existingSessionHome && step === 'credentials' && (
        <div className={cardClassName} data-testid="existing-session-card">
          <p className={premium.sessionTitle}>Une session FODIP est déjà active.</p>
          <p className={premium.lead}>
            Continuez vers l’espace autorisé pour ce compte, ou fermez volontairement la session avant de changer d’utilisateur.
          </p>
          {error && <div className={`${styles.notice} ${premium.notice}`} role="alert">{error}</div>}
          <div className={premium.actions}>
            <button className={styles.primary} type="button" onClick={() => router.replace(existingSessionHome)}>
              Continuer vers mon espace
            </button>
            <button className={styles.secondary} type="button" disabled={loading} onClick={switchAccount}>
              {loading ? 'Fermeture…' : 'Changer d’utilisateur'}
            </button>
          </div>
        </div>
      )}

      {!checkingSession && !existingSessionHome && step === 'credentials' && (
        <form className={cardClassName} onSubmit={submitCredentials}>
          <div className={premium.formGrid}>
            <div className={premium.field}>
              <label htmlFor="email">Email</label>
              <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className={premium.field}>
              <label htmlFor="password">Mot de passe</label>
              <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
          </div>
          {error && <div className={`${styles.notice} ${premium.notice}`} role="alert" data-testid="login-error">{error}</div>}
          <div className={premium.actions}>
            <button className={styles.primary} disabled={loading}>{loading ? 'Connexion…' : 'Se connecter'}</button>
            {oidcPortal && (
              <a className={styles.secondary} href={`/api/session/oidc/start?portal=${oidcPortal}`}>
                Se connecter avec un compte institutionnel (SSO)
              </a>
            )}
          </div>
        </form>
      )}

      {step === 'setup' && (
        <div className={cardClassName}>
          <p className={`${premium.lead} ${premium.mfaLead}`}>
            Ce compte exige une double authentification. Ouvrez une application d’authentification (Google Authenticator, Authy…),
            ajoutez un compte manuellement avec la clé secrète ci-dessous, puis saisissez le code à 6 chiffres qu’elle affiche.
          </p>
          <div className={premium.secretCard}>
            <strong style={{ display: 'block', marginBottom: 6 }}>Clé secrète</strong>
            <code style={{ fontSize: '1rem', letterSpacing: '0.05em', wordBreak: 'break-all' }}>{secret}</code>
          </div>
          <form onSubmit={(event) => submitCode(event, 'confirm')}>
            <div className={premium.formGrid}>
              <div className={premium.field}>
                <label htmlFor="code">Code à 6 chiffres</label>
                <input id="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={6}
                  value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} />
              </div>
            </div>
            {error && <div className={`${styles.notice} ${premium.notice}`} role="alert" data-testid="login-error">{error}</div>}
            <div className={premium.actions}>
              <button className={styles.primary} disabled={loading}>{loading ? 'Vérification…' : 'Activer et se connecter'}</button>
            </div>
          </form>
        </div>
      )}

      {step === 'verify' && (
        <div className={cardClassName}>
          <p className={`${premium.lead} ${premium.mfaLead}`}>Saisissez le code à 6 chiffres généré par votre application d’authentification.</p>
          <form onSubmit={(event) => submitCode(event, 'verify')}>
            <div className={premium.formGrid}>
              <div className={premium.field}>
                <label htmlFor="code">Code à 6 chiffres</label>
                <input id="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={6}
                  value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} />
              </div>
            </div>
            {error && <div className={`${styles.notice} ${premium.notice}`} role="alert" data-testid="login-error">{error}</div>}
            <div className={premium.actions}>
              <button className={styles.primary} disabled={loading}>{loading ? 'Vérification…' : 'Se connecter'}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
