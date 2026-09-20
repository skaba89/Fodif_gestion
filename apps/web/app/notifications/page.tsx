'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { clientApi } from '../../lib/client-api';
import { resolveRoleHome } from '../../lib/portal-access';
import Breadcrumbs from '../_shared/Breadcrumbs';
import { humanizeCode } from '../_shared/displayLabels';
import AccountPageHeader from '../_shared/AccountPageHeader';
import portal from '../entrepreneur/portal.module.css';
import styles from './notifications.module.css';

type Notification = {
  id: string; type: string; titre: string; message: string; lien?: string;
  luAt?: string | null; createdAt: string;
};

type NotificationsResponse = { items?: Notification[]; unread?: number };
type SessionResponse = { roles?: string[] };

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [message, setMessage] = useState('');
  const [returnPath, setReturnPath] = useState('/entrepreneur');

  const load = useCallback(async () => {
    const body = await clientApi<NotificationsResponse>(`/api/notifications?unreadOnly=${unreadOnly}`);
    setItems(body.items ?? []); setUnread(body.unread ?? 0);
  }, [unreadOnly]);

  useEffect(() => {
    load().catch((error) => setMessage(error instanceof Error ? error.message : 'Chargement impossible'));
    clientApi<SessionResponse>('/api/session/me').then((user) => {
      setReturnPath(resolveRoleHome(user.roles ?? []) ?? '/entrepreneur');
    }).catch(() => undefined);
  }, [load]);

  async function markRead(id: string) {
    try {
      await clientApi(`/api/notifications/${id}/read`, { method: 'PATCH' });
      await load();
    } catch {
      setMessage('Impossible de marquer la notification comme lue.');
    }
  }

  async function markAll() {
    try {
      await clientApi('/api/notifications/read-all', { method: 'PATCH' });
      await load();
    } catch {
      setMessage('Impossible de mettre à jour les notifications.');
    }
  }

  return <div className={portal.shell}><a href="#main-content" className="skip-link">Aller au contenu principal</a><AccountPageHeader homeHref={returnPath} subtitle="Centre de notifications" /><main id="main-content" tabIndex={-1} className={portal.main}>
    <Breadcrumbs items={[{ label: 'Mon espace', href: returnPath }, { label: 'Notifications' }]} />
    <p className={portal.eyebrow}>Activité personnelle</p><h1 className={portal.title}>Notifications</h1>
    <p className={portal.lead}>{unread === 0 ? 'Vous êtes à jour. ' : `${unread} notification${unread === 1 ? '' : 's'} non lue${unread === 1 ? '' : 's'}. `}Les événements sont enregistrés atomiquement avec les opérations métier.</p>
    {(items.length > 0 || unreadOnly) && <div className={styles.toolbar}>
      <button className={portal.secondary} type="button" onClick={() => setUnreadOnly((value) => !value)}>{unreadOnly ? 'Afficher tout' : 'Afficher les non lues'}</button>
      {unread > 0 && <button className={portal.primary} type="button" onClick={markAll}>Tout marquer comme lu</button>}
    </div>}
    {message && <div className={`${portal.notice} ${portal.section}`} role="alert">{message}</div>}
    <section className={`${portal.section} ${styles.activity}`} aria-label="Historique des notifications">
      {items.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyMark} aria-hidden="true" />
          <div><h2>{unreadOnly ? 'Aucune notification non lue' : 'Vous êtes à jour'}</h2><p>{unreadOnly ? 'Toutes les notifications disponibles ont déjà été consultées.' : 'Aucune nouvelle activité ne nécessite votre attention pour le moment.'}</p></div>
        </div>
      ) : items.map((item) => (
        <article className={item.luAt ? styles.item : `${styles.item} ${styles.unread}`} key={item.id}>
          <div className={styles.marker} aria-hidden="true" />
          <div className={styles.body}>
            <div className={styles.meta}>
              <span>{humanizeCode(item.type)}</span>
              <time>{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}</time>
            </div>
            <h2>{item.titre}</h2>
            <p>{item.message}</p>
          </div>
          <div className={styles.actions}>
            {item.lien && <Link className={portal.secondary} href={item.lien} onClick={() => markRead(item.id)}>Ouvrir</Link>}
            {!item.luAt && <button className={styles.readAction} type="button" onClick={() => markRead(item.id)}>Marquer comme lue</button>}
          </div>
        </article>
      ))}
    </section>
  </main><footer className={portal.footer}>FODIP Digital 2030 · Notifications sécurisées par utilisateur</footer></div>;
}
