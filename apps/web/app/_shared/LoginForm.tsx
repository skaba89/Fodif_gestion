'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from '../entrepreneur/portal.module.css';

type Step = 'credentials' | 'setup' | 'verify';
type OidcPortal = 'agent' | 'comite' | 'direction' | 'administration' | 'auditeur';

interface SessionResponse {
  message?: string;
  mfaSetupRequired?: boolean;
  mfaRequired?: boolean;
  mfaChallenge?: string;
  secret?: string;
  user?: { roles?: string[] };
}

export interface LoginFormProps {
  eyebrow: string;
  title: string;
  lead: string;
  redirectTo: string;
  /** Roles allowed to use this portal. Omit to accept any authenticated account. */
  allowedRoles?: string[];
  deniedMessage?: string;
  /** 'narrow' renders a single centered card (used by /administration); 'wide' matches the other portals. */
  variant?: 'wide' | 'narrow';
  replaceHistory?: boolean;
  /** Offers "sign in with SSO" for this portal when OIDC (docs/14 axe B4) is configured on the API.
   * Omit for portals that shouldn't offer it (entrepreneur/PME accounts aren't institutional). */
  oidcPortal?: OidcPortal;
}

/**
 * Shared login flow for every portal. Handles the plain email/password case, the two-step TOTP
 * flow returned by the API for accounts flagged `mfa_required` (enrollment then verification, or
 * verification alone once enrolled), and resuming an OpenID Connect sign-in: the API's
 * /auth/oidc/callback redirects the browser straight back to this same page with an
 * `oidc_token` (or `oidc_error`) query param, which is picked up on mount and exchanged exactly
 * like an MFA challenge would be - it may itself resolve to an MFA challenge, since OIDC doesn't
 * bypass our own TOTP requirement for accounts that have it.
 */
export default function LoginForm(props: LoginFormProps) {
  return (
    <Suspense fallback={<main className={props.variant === 'narrow' ? undefined : styles.main} />}>
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
  variant = 'wide',
  replaceHistory = false,
  oidcPortal,
}: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oidcToken = searchParams.get('oidc_token');
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(() => Boolean(oidcToken));

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
      await fetch('/api/session/logout', { method: 'POST' });
      throw new Error(deniedMessage ?? 'Ce compte ne possède pas les droits nécessaires.');
    }
    if (replaceHistory) router.replace(redirectTo); else router.push(redirectTo);
    router.refresh();
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
      setError('Aucun compte actif ne correspond à cette identité. Contactez un administrateur.');
    } else if (oidcError) {
      setError('La connexion via le fournisseur d’identité a échoué. Réessayez, ou utilisez votre mot de passe.');
    }
    // Runs once on mount only: this is consuming a one-time redirect result, not reacting to
    // ongoing URL changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const card = variant === 'narrow'
    ? { className: `${styles.card} ${styles.formCard}`, style: { maxWidth: 560, margin: '50px auto' } }
    : { className: `${styles.card} ${styles.formCard} ${styles.section}` };

  return (
    <main className={styles.main}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.lead}>{lead}</p>

      {step === 'credentials' && (
        <form {...card} onSubmit={submitCredentials}>
          <div className={styles.formGrid}>
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label htmlFor="email">Email</label>
              <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label htmlFor="password">Mot de passe</label>
              <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
          </div>
          {error && <div className={styles.notice} role="alert" data-testid="login-error">{error}</div>}
          <div className={styles.buttonRow}>
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
        <div {...card}>
          <p className={styles.lead}>
            Ce compte exige une double authentification. Ouvrez une application d’authentification (Google Authenticator, Authy…),
            ajoutez un compte manuellement avec la clé secrète ci-dessous, puis saisissez le code à 6 chiffres qu’elle affiche.
          </p>
          <div className={styles.notice}>
            <strong style={{ display: 'block', marginBottom: 6 }}>Clé secrète</strong>
            <code style={{ fontSize: '1rem', letterSpacing: '0.05em', wordBreak: 'break-all' }}>{secret}</code>
          </div>
          <form onSubmit={(event) => submitCode(event, 'confirm')} style={{ marginTop: 16 }}>
            <div className={styles.formGrid}>
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label htmlFor="code">Code à 6 chiffres</label>
                <input id="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={6}
                  value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} />
              </div>
            </div>
            {error && <div className={styles.notice} role="alert" data-testid="login-error">{error}</div>}
            <div className={styles.buttonRow}>
              <button className={styles.primary} disabled={loading}>{loading ? 'Vérification…' : 'Activer et se connecter'}</button>
            </div>
          </form>
        </div>
      )}

      {step === 'verify' && (
        <div {...card}>
          <p className={styles.lead}>Saisissez le code à 6 chiffres généré par votre application d’authentification.</p>
          <form onSubmit={(event) => submitCode(event, 'verify')}>
            <div className={styles.formGrid}>
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label htmlFor="code">Code à 6 chiffres</label>
                <input id="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={6}
                  value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} />
              </div>
            </div>
            {error && <div className={styles.notice} role="alert" data-testid="login-error">{error}</div>}
            <div className={styles.buttonRow}>
              <button className={styles.primary} disabled={loading}>{loading ? 'Vérification…' : 'Se connecter'}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
