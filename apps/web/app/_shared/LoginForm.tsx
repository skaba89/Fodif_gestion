'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { resolveRoleHome } from '../../lib/portal-access';
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
  redirectTo?: string;
  allowedRoles?: string[];
  deniedMessage?: string;
  redirectWrongRoleToHome?: boolean;
  variant?: 'wide' | 'narrow';
  replaceHistory?: boolean;
  oidcPortal?: OidcPortal;
}

function ClockIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
}

function ShieldIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.7 2.8 8.1 7 10 4.2-1.9 7-5.3 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>;
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden
    ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18" /><path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" /><path d="M9.9 5.1A10.7 10.7 0 0 1 12 5c5.5 0 9 7 9 7a16 16 0 0 1-2.2 3.1M6.2 6.2C4.1 7.6 3 12 3 12s3.5 7 9 7c1.2 0 2.3-.3 3.3-.7" /></svg>
    : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
}

export default function LoginForm(props: LoginFormProps) {
  return (
    <Suspense fallback={<main className={premium.page}><div className={premium.authPane}><div className={premium.formShell}><div className={premium.skeleton} /></div></div></main>}>
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
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryHelp, setRecoveryHelp] = useState(false);
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
      setError('La connexion institutionnelle a échoué. Réessayez ou utilisez votre mot de passe.');
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

  const credentialError = step === 'credentials' ? error : '';

  return (
    <main className={premium.page}>
      <section className={premium.authPane} aria-labelledby="login-title">
        <div className={premium.formShell}>
          <div className={premium.mobileBrand}><FodipOfficialBrand subtitle="FODIP Digital 2030" /></div>
          <header className={premium.formHeader}>
            <p className={premium.eyebrow}>{eyebrow}</p>
            <h1 className={premium.title} id="login-title">{title}</h1>
            <p className={premium.lead}>{lead}</p>
          </header>

          {checkingSession ? (
            <div className={premium.loadingState} role="status" aria-live="polite">
              <span className={premium.skeletonLine} /><span className={premium.skeletonLineShort} />
              <span className="sr-only">Vérification de la session sécurisée…</span>
            </div>
          ) : null}

          {!checkingSession && existingSessionHome && step === 'credentials' ? (
            <section className={premium.existingSession} data-testid="existing-session-card">
              <span className={premium.securityMark}><ShieldIcon /></span>
              <div>
                <h2>Une session FODIP est déjà active</h2>
                <p>Continuez vers votre espace autorisé, ou fermez volontairement la session avant de changer de compte.</p>
              </div>
              {error ? <p className={premium.fieldError} role="alert">{error}</p> : null}
              <div className={premium.actions}>
                <button className={premium.primaryButton} type="button" onClick={() => router.replace(existingSessionHome)}>Continuer vers mon espace</button>
                <button className={premium.secondaryButton} type="button" disabled={loading} onClick={switchAccount}>{loading ? 'Fermeture…' : 'Changer d’utilisateur'}</button>
              </div>
            </section>
          ) : null}

          {!checkingSession && !existingSessionHome && step === 'credentials' ? (
            <form className={premium.form} onSubmit={submitCredentials} noValidate>
              {sessionExpired ? (
                <div className={premium.sessionBanner} role="status" data-testid="session-expired-notice">
                  <ClockIcon />
                  <span><strong>Session expirée.</strong> Reconnectez-vous pour reprendre votre activité.</span>
                </div>
              ) : null}

              <div className={premium.field}>
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  aria-invalid={Boolean(credentialError) || undefined}
                  value={email}
                  onChange={(event) => { setEmail(event.target.value); if (error) setError(''); }}
                  placeholder="nom@organisation.gn"
                />
              </div>

              <div className={premium.field}>
                <div className={premium.labelRow}>
                  <label htmlFor="password">Mot de passe</label>
                  <button className={premium.textButton} type="button" onClick={() => setRecoveryHelp((value) => !value)}>Mot de passe oublié ?</button>
                </div>
                <div className={premium.passwordField}>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    aria-invalid={Boolean(credentialError) || undefined}
                    aria-describedby={credentialError ? 'login-field-error' : recoveryHelp ? 'password-help' : undefined}
                    value={password}
                    onChange={(event) => { setPassword(event.target.value); if (error) setError(''); }}
                  />
                  <button
                    className={premium.passwordToggle}
                    type="button"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    <EyeIcon hidden={showPassword} />
                  </button>
                </div>
                {credentialError ? <p id="login-field-error" className={premium.fieldError} role="alert" data-testid="login-error">{credentialError}</p> : null}
                {recoveryHelp ? <p id="password-help" className={premium.helpText}>Pour réinitialiser un accès institutionnel, contactez votre administrateur FODIP. Aucun mot de passe ne vous sera demandé par téléphone.</p> : null}
              </div>

              <button className={premium.primaryButton} disabled={loading} aria-busy={loading}>
                {loading ? 'Connexion sécurisée…' : 'Se connecter'}
              </button>

              {oidcPortal ? (
                <>
                  <div className={premium.separator}><span>ou</span></div>
                  <a className={premium.ssoButton} href={`/api/session/oidc/start?portal=${oidcPortal}`}>
                    <ShieldIcon />
                    <span>Se connecter avec un compte institutionnel</span>
                  </a>
                </>
              ) : null}
            </form>
          ) : null}

          {step === 'setup' ? (
            <section className={premium.mfaCard}>
              <span className={premium.securityMark}><ShieldIcon /></span>
              <h2>Activer la double authentification</h2>
              <p>Ajoutez la clé ci-dessous dans votre application d’authentification puis saisissez le code à 6 chiffres.</p>
              <div className={premium.secretCard}><span>Clé secrète</span><code>{secret}</code></div>
              <form onSubmit={(event) => submitCode(event, 'confirm')}>
                <div className={premium.field}>
                  <label htmlFor="code">Code à 6 chiffres</label>
                  <input id="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} />
                  {error ? <p className={premium.fieldError} role="alert" data-testid="login-error">{error}</p> : null}
                </div>
                <button className={premium.primaryButton} disabled={loading}>{loading ? 'Vérification…' : 'Activer et se connecter'}</button>
              </form>
            </section>
          ) : null}

          {step === 'verify' ? (
            <section className={premium.mfaCard}>
              <span className={premium.securityMark}><ShieldIcon /></span>
              <h2>Double authentification</h2>
              <p>Saisissez le code à 6 chiffres généré par votre application d’authentification.</p>
              <form onSubmit={(event) => submitCode(event, 'verify')}>
                <div className={premium.field}>
                  <label htmlFor="code">Code à 6 chiffres</label>
                  <input id="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} />
                  {error ? <p className={premium.fieldError} role="alert" data-testid="login-error">{error}</p> : null}
                </div>
                <button className={premium.primaryButton} disabled={loading}>{loading ? 'Vérification…' : 'Se connecter'}</button>
              </form>
            </section>
          ) : null}

          <footer className={premium.legalFooter}>
            <nav aria-label="Liens légaux"><a href="/mentions-legales">Mentions légales</a><a href="/accessibilite">Accessibilité</a><a href="/confidentialite">Confidentialité</a></nav>
            <span>République de Guinée — FODIP</span>
          </footer>
        </div>
      </section>

      <aside className={premium.missionPanel} aria-label="Mission FODIP Digital 2030">
        <div className={premium.missionBrand}><FodipOfficialBrand subtitle="FODIP Digital 2030" /></div>
        <div className={premium.missionContent}>
          <p className={premium.missionKicker}>Institution financière numérique</p>
          <h2>Financer la croissance des PME guinéennes avec rigueur, transparence et impact.</h2>
          <p>Une même chaîne de confiance, de la demande au décaissement puis au suivi du remboursement et des emplois créés.</p>
        </div>
        <dl className={premium.trustStats}>
          <div><dt>PME financées</dt><dd>200+</dd></div>
          <div><dt>GNF décaissés</dt><dd>45 Mds</dd></div>
          <div><dt>Couverture</dt><dd>8 régions</dd></div>
        </dl>
        <p className={premium.panelFoot}>Dossier → Instruction → Décision → Financement → Suivi</p>
      </aside>
    </main>
  );
}
