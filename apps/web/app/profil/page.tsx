'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './profile.module.css';

type SessionProfile = {
  email: string;
  roles: string[];
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super administrateur',
  AGENT_FODIP: 'Agent FODIP',
  PME: 'PME',
  PARTENAIRE_BANCAIRE: 'Partenaire bancaire',
  DIRECTION: 'Direction',
  COMITE: 'Comité de financement',
  AUDITEUR: 'Auditeur',
};

function formatRole(role: string) {
  return ROLE_LABELS[role] ?? role.replaceAll('_', ' ').toLocaleLowerCase('fr-FR').replace(/^./, (letter) => letter.toLocaleUpperCase('fr-FR'));
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/session/me', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('SESSION_UNAVAILABLE');
        return response.json() as Promise<SessionProfile>;
      })
      .then((session) => {
        setProfile({
          email: session.email,
          roles: Array.isArray(session.roles) ? session.roles : [],
        });
        setState('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState('unavailable');
      });

    return () => controller.abort();
  }, []);

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/');
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.topbar}>
          <Link href="/" className={styles.brand} aria-label="FODIP Digital - accueil">
            <span className={styles.mark} aria-hidden="true">FD</span>
            <span className={styles.brandCopy}>
              <strong>FODIP DIGITAL</strong>
              <span>Plateforme institutionnelle</span>
            </span>
          </Link>
          <button type="button" className={styles.backButton} onClick={goBack}>Retour à l’espace</button>
        </div>

        <section className={styles.hero} aria-labelledby="profile-title">
          <p className={styles.eyebrow}>Compte sécurisé</p>
          <h1 id="profile-title" className={styles.title}>Mon profil</h1>
          <p className={styles.lead}>
            Retrouvez ici, et uniquement ici, les informations d’identification et d’habilitation associées à votre compte.
          </p>
        </section>

        {state === 'loading' && (
          <section className={styles.stateCard} role="status">
            <strong>Chargement du profil</strong>
            <p>Vérification de votre session sécurisée en cours.</p>
          </section>
        )}

        {state === 'unavailable' && (
          <section className={styles.stateCard} role="alert">
            <strong>Profil indisponible</strong>
            <p>Votre session n’est plus disponible. Revenez à votre espace de connexion pour vous authentifier à nouveau.</p>
          </section>
        )}

        {state === 'ready' && profile && (
          <>
            <section className={styles.profileCard} aria-label="Informations du profil">
              <div className={styles.cardHeader}>
                <div className={styles.avatar} aria-hidden="true">FD</div>
                <div className={styles.cardIdentity}>
                  <span>Compte FODIP Digital</span>
                  <strong>Profil utilisateur</strong>
                </div>
                <span className={styles.status}>Session active</span>
              </div>

              <dl className={styles.details}>
                <div className={styles.detail}>
                  <dt>Adresse e-mail</dt>
                  <dd data-testid="profile-email">{profile.email}</dd>
                </div>
                <div className={styles.detail}>
                  <dt>Rôle et habilitation</dt>
                  <dd className={styles.roles} data-testid="profile-roles">
                    {profile.roles.length > 0
                      ? profile.roles.map((role) => <span className={styles.role} key={role}>{formatRole(role)}</span>)
                      : <span>Aucun rôle affichable</span>}
                  </dd>
                </div>
              </dl>
            </section>

            <aside className={styles.privacyNote} aria-label="Confidentialité de l’interface">
              <span className={styles.noteMark} aria-hidden="true" />
              <div>
                <strong>Affichage volontairement discret</strong>
                <p>L’adresse e-mail et les rôles de votre compte sont masqués dans le header, le menu et les écrans de navigation généraux.</p>
              </div>
            </aside>
          </>
        )}
      </div>
    </main>
  );
}
