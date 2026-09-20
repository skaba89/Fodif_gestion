'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { clientApi } from '../../lib/client-api';
import { resolveRoleHome } from '../../lib/portal-access';
import Breadcrumbs from '../_shared/Breadcrumbs';
import { humanizeCode } from '../_shared/displayLabels';
import AccountPageHeader from '../_shared/AccountPageHeader';
import portal from '../entrepreneur/portal.module.css';

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
    <p className={portal.lead}>{unread} notification{unread === 1 ? '' : 's'} non lue{unread === 1 ? '' : 's'}. Les événements sont enregistrés atomiquement avec les opérations métier.</p>
    <div className={portal.buttonRow}>
      <button className={portal.secondary} type="button" onClick={() => setUnreadOnly((value) => !value)}>{unreadOnly ? 'Afficher tout' : 'Afficher les non lues'}</button>
      <button className={portal.primary} type="button" onClick={markAll} disabled={unread === 0}>Tout marquer comme lu</button>
    </div>
    {message && <div className={`${portal.notice} ${portal.section}`} role="alert">{message}</div>}
    <section className={portal.section}>{items.length === 0 ? <article className={portal.card}><p>Aucune notification dans ce périmètre.</p></article> : items.map((item) => <article className={`${portal.card} ${portal.section}`} key={item.id} style={{ opacity: item.luAt ? .68 : 1 }}>
      <div className={portal.sectionHeader}><div><p className={portal.eyebrow}>{humanizeCode(item.type)}</p><h2>{item.titre}</h2></div><time>{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}</time></div>
      <p className={portal.lead}>{item.message}</p><div className={portal.buttonRow}>
        {item.lien && <Link className={portal.primary} href={item.lien} onClick={() => markRead(item.id)}>Ouvrir</Link>}
        {!item.luAt && <button className={portal.secondary} type="button" onClick={() => markRead(item.id)}>Marquer comme lue</button>}
      </div>
    </article>)}</section>
  </main><footer className={portal.footer}>FODIP Digital 2030 · Notifications sécurisées par utilisateur</footer></div>;
}
