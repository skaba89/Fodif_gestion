'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import portal from '../entrepreneur/portal.module.css';

type Notification = {
  id: string; type: string; titre: string; message: string; lien?: string;
  luAt?: string | null; createdAt: string;
};

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [message, setMessage] = useState('');
  const [returnPath, setReturnPath] = useState('/entrepreneur');

  const load = useCallback(async () => {
    const response = await fetch(`/api/notifications?unreadOnly=${unreadOnly}`, { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message ?? 'Chargement impossible');
    setItems(body.items ?? []); setUnread(body.unread ?? 0);
  }, [unreadOnly]);

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
    fetch('/api/session/me', { cache: 'no-store' }).then((response) => response.json()).then((user) => {
      const roles: string[] = user.roles ?? [];
      if (roles.includes('SUPER_ADMIN')) setReturnPath('/administration/utilisateurs');
      else if (roles.some((role) => ['DIRECTION_FODIP', 'ANALYSTE'].includes(role))) setReturnPath('/direction/tableau-de-bord');
      else if (roles.includes('AGENT_FODIP')) setReturnPath('/agent/dossiers');
      else if (roles.includes('COMITE_FINANCEMENT')) setReturnPath('/comite/dossiers');
    }).catch(() => undefined);
  }, [load]);

  async function markRead(id: string) {
    const response = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    if (!response.ok) return setMessage('Impossible de marquer la notification comme lue.');
    await load();
  }

  async function markAll() {
    const response = await fetch('/api/notifications/read-all', { method: 'PATCH' });
    if (!response.ok) return setMessage('Impossible de mettre à jour les notifications.');
    await load();
  }

  return <div className={portal.shell}><header className={portal.header}>
    <Link href={returnPath} className={portal.brand}><span className={portal.mark}>FD</span><span className={portal.brandText}><strong>FODIP DIGITAL</strong><span>Centre de notifications</span></span></Link>
    <nav className={portal.nav}><Link href={returnPath}>Retour au portail</Link></nav>
  </header><main className={portal.main}>
    <p className={portal.eyebrow}>Activité personnelle</p><h1 className={portal.title}>Notifications</h1>
    <p className={portal.lead}>{unread} notification{unread === 1 ? '' : 's'} non lue{unread === 1 ? '' : 's'}. Les événements sont enregistrés atomiquement avec les opérations métier.</p>
    <div className={portal.buttonRow}>
      <button className={portal.secondary} type="button" onClick={() => setUnreadOnly((value) => !value)}>{unreadOnly ? 'Afficher tout' : 'Afficher les non lues'}</button>
      <button className={portal.primary} type="button" onClick={markAll} disabled={unread === 0}>Tout marquer comme lu</button>
    </div>
    {message && <div className={`${portal.notice} ${portal.section}`} role="alert">{message}</div>}
    <section className={portal.section}>{items.length === 0 ? <article className={portal.card}><p>Aucune notification dans ce périmètre.</p></article> : items.map((item) => <article className={`${portal.card} ${portal.section}`} key={item.id} style={{ opacity: item.luAt ? .68 : 1 }}>
      <div className={portal.sectionHeader}><div><p className={portal.eyebrow}>{item.type.replaceAll('_', ' ')}</p><h2>{item.titre}</h2></div><time>{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}</time></div>
      <p className={portal.lead}>{item.message}</p><div className={portal.buttonRow}>
        {item.lien && <Link className={portal.primary} href={item.lien} onClick={() => markRead(item.id)}>Ouvrir</Link>}
        {!item.luAt && <button className={portal.secondary} type="button" onClick={() => markRead(item.id)}>Marquer comme lue</button>}
      </div>
    </article>)}</section>
  </main><footer className={portal.footer}>FODIP Digital 2030 · Notifications sécurisées par utilisateur</footer></div>;
}
