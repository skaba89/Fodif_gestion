'use client';

import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';
import { clientApi } from '../../lib/client-api';
import { resolveRoleHome } from '../../lib/portal-access';
import FodipOfficialBrand from '../_shared/FodipOfficialBrand';
import styles from './support.module.css';

type Message = {
  role: 'assistant' | 'user';
  text: string;
  actions?: Array<{ label: string; href: string }>;
};

type SupportResponse = {
  answer: string;
  humanHandoff: boolean;
  actions: Array<{ label: string; href: string }>;
};

type SessionResponse = { roles?: string[] };

const QUICK_QUESTIONS = [
  'Quels documents dois-je préparer ?',
  'Comment suivre mon dossier ?',
  'Comment fonctionnent les relances WhatsApp ?',
  'Comment contacter un agent FODIP ?',
];

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  text: "Bonjour. Je suis l'assistant d'orientation FODIP. Je peux vous guider sur les démarches, les documents, le suivi, les programmes, les remboursements et WhatsApp. Je ne prends aucune décision et je ne révèle aucune donnée personnelle de dossier.",
};

export default function AssistancePage() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [loading, setLoading] = useState(false);
  const [returnPath, setReturnPath] = useState('/');
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    // Assistance remains public. This lightweight session probe only improves the return link; a
    // 401 is intentionally ignored so unauthenticated visitors can still use the public guidance.
    fetch('/api/session/me', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return;
        const session = (await response.json().catch(() => ({}))) as SessionResponse;
        const home = resolveRoleHome(session.roles ?? []);
        if (home) {
          setReturnPath(home);
          setAuthenticated(true);
        }
      })
      .catch(() => undefined);
  }, []);

  async function ask(value: string) {
    const trimmed = value.trim();
    if (trimmed.length < 2 || loading) return;

    setMessages((current) => [...current, { role: 'user', text: trimmed }]);
    setQuestion('');
    setLoading(true);

    try {
      const result = await clientApi<SupportResponse>('/api/support/assistant', {
        method: 'POST',
        body: JSON.stringify({ question: trimmed }),
      });

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: result.answer,
          actions: result.actions,
        },
      ]);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: "Le service d'assistance est momentanément indisponible. Réessayez plus tard ou utilisez le canal de support institutionnel indiqué dans votre espace.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(question);
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell} aria-labelledby="support-title">
        <header className={styles.header}>
          <div>
            <FodipOfficialBrand subtitle="Assistance et orientation" compact />
            <p className={styles.eyebrow}>FODIP Digital 2030</p>
            <h1 id="support-title">Assistant d'orientation et de support</h1>
            <p className={styles.subtitle}>
              Un point d'entrée sécurisé pour comprendre les démarches et trouver le bon canal d'assistance.
            </p>
          </div>
          <Link className={styles.homeLink} href={returnPath}>{authenticated ? 'Retour à mon espace' : 'Retour aux espaces'}</Link>
        </header>

        <aside className={styles.notice} aria-label="Limites de l'assistant">
          <strong>Cadre de sécurité.</strong> Ne saisissez jamais de mot de passe, code MFA, coordonnées bancaires ou document sensible. L'assistant ne valide, ne rejette et ne modifie aucun dossier ou financement.
        </aside>

        <div className={styles.quickActions} aria-label="Questions fréquentes">
          {QUICK_QUESTIONS.map((item) => (
            <button key={item} type="button" onClick={() => void ask(item)} disabled={loading}>
              {item}
            </button>
          ))}
        </div>

        <section className={styles.conversation} aria-label="Conversation avec l'assistant" aria-live="polite">
          {messages.map((message, index) => (
            <article
              className={message.role === 'assistant' ? styles.assistantMessage : styles.userMessage}
              key={`${message.role}-${index}-${message.text.slice(0, 16)}`}
            >
              <p className={styles.messageAuthor}>{message.role === 'assistant' ? 'Assistant FODIP' : 'Vous'}</p>
              <p>{message.text}</p>
              {message.actions?.length ? (
                <div className={styles.messageActions}>
                  {message.actions.map((action) => (
                    <Link key={`${action.href}-${action.label}`} href={action.href}>{action.label}</Link>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
          {loading ? <p className={styles.loading} role="status">Recherche de la meilleure orientation...</p> : null}
        </section>

        <form className={styles.form} onSubmit={submit}>
          <label htmlFor="support-question">Votre question</label>
          <textarea
            id="support-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            minLength={2}
            maxLength={500}
            rows={3}
            placeholder="Exemple : comment suivre l'avancement de ma demande ?"
            required
          />
          <div className={styles.formFooter}>
            <span aria-live="off">{question.length}/500 caractères</span>
            <button type="submit" disabled={loading || question.trim().length < 2}>
              {loading ? 'Envoi en cours' : 'Envoyer'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
