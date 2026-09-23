'use client';

import { useCallback, useEffect, useState } from 'react';
import { clientApi } from '../../lib/client-api';
import { resolveRoleHome } from '../../lib/portal-access';
import Breadcrumbs from '../_shared/Breadcrumbs';
import AccountPageHeader from '../_shared/AccountPageHeader';
import portal from '../entrepreneur/portal.module.css';
import styles from './mes-donnees.module.css';

type SessionResponse = { roles?: string[] };

export default function MesDonneesPage() {
  const [message, setMessage] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [returnPath, setReturnPath] = useState('/entrepreneur');

  useEffect(() => {
    clientApi<SessionResponse>('/api/session/me').then((user) => {
      setReturnPath(resolveRoleHome(user.roles ?? []) ?? '/entrepreneur');
    }).catch(() => undefined);
  }, []);

  const download = useCallback(async () => {
    setMessage(''); setDownloading(true);
    try {
      const body = await clientApi<unknown>('/api/data-rights/export');
      const blob = new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `fodip-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link); link.click(); link.remove();
      URL.revokeObjectURL(url);
      setMessage('Export téléchargé. L’opération a été enregistrée dans le journal d’audit.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Export impossible');
    } finally {
      setDownloading(false);
    }
  }, []);

  return <div className={portal.shell}><a href="#main-content" className="skip-link">Aller au contenu principal</a><AccountPageHeader homeHref={returnPath} subtitle="Mes données" /><main id="main-content" tabIndex={-1} className={portal.main}>
    <Breadcrumbs items={[{ label: 'Mon espace', href: returnPath }, { label: 'Mes données' }]} />
    <p className={portal.eyebrow}>Droits des personnes</p><h1 className={portal.title}>Mes données personnelles</h1>
    <p className={portal.lead}>
      Conformément au droit d’accès à vos données, vous pouvez télécharger une copie de tout ce que la plateforme
      détient sur votre compte : profil, et, pour un compte PME, les informations de votre entreprise, ses
      dirigeants et vos dossiers de financement. Le fichier est au format JSON, lisible par tout tableur ou éditeur
      de texte.
    </p>
    {message && <div className={`${portal.notice} ${portal.section}`} role="status">{message}</div>}
    <div className={`${portal.section} ${styles.rights}`}>
      <section className={styles.right}>
        <div>
          <p className={styles.index}>01</p>
          <h2>Accéder à mes données</h2>
          <p>Téléchargez une copie structurée des données rattachées à votre compte. Chaque export est journalisé dans le registre d’audit.</p>
        </div>
        <button className={portal.primary} type="button" onClick={download} disabled={downloading}>{downloading ? 'Préparation…' : 'Télécharger mes données (JSON)'}</button>
      </section>
      <section className={styles.right}>
        <div>
          <p className={styles.index}>02</p>
          <h2>Demander l’effacement</h2>
          <p>Contactez votre administrateur FODIP pour demander la suppression du compte. La demande est traitée manuellement ; l’identité peut être anonymisée tandis que les éléments devant être conservés pour la traçabilité restent dans les historiques concernés.</p>
        </div>
      </section>
    </div>
  </main><footer className={portal.footer}>FODIP Digital 2030 · Droits des personnes</footer></div>;
}
