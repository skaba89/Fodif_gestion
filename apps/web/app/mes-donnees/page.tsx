'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { clientApi } from '../../lib/client-api';
import { resolveRoleHome } from '../../lib/portal-access';
import ThemeToggle from '../_shared/ThemeToggle';
import portal from '../entrepreneur/portal.module.css';

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

  return <div className={portal.shell}><a href="#main-content" className="skip-link">Aller au contenu principal</a><header className={portal.header}>
    <Link href={returnPath} className={portal.brand}><span className={portal.mark}>FD</span><span className={portal.brandText}><strong>FODIP DIGITAL</strong><span>Mes données</span></span></Link>
    <nav className={portal.nav}><Link href={returnPath}>Retour au portail</Link></nav>
    <ThemeToggle buttonClassName={portal.themeToggle} />
  </header><main id="main-content" tabIndex={-1} className={portal.main}>
    <p className={portal.eyebrow}>Droits des personnes (axe B6)</p><h1 className={portal.title}>Mes données personnelles</h1>
    <p className={portal.lead}>
      Conformément au droit d’accès à vos données, vous pouvez télécharger une copie de tout ce que la plateforme
      détient sur votre compte : profil, et, pour un compte PME, les informations de votre entreprise, ses
      dirigeants et vos dossiers de financement. Le fichier est au format JSON, lisible par tout tableur ou éditeur
      de texte.
    </p>
    {message && <div className={`${portal.notice} ${portal.section}`} role="status">{message}</div>}
    <section className={`${portal.card} ${portal.section}`}>
      <div className={portal.sectionHeader}><div><h2>Export de mes données</h2><p>Chaque export est journalisé dans le registre d’audit de votre compte.</p></div></div>
      <div className={portal.buttonRow}><button className={portal.primary} type="button" onClick={download} disabled={downloading}>{downloading ? 'Préparation…' : 'Télécharger mes données (JSON)'}</button></div>
    </section>
    <section className={`${portal.card} ${portal.section}`}>
      <div className={portal.sectionHeader}><div><h2>Droit à l’effacement</h2><p>Pour demander la suppression de votre compte, contactez votre administrateur FODIP : la demande est traitée manuellement et votre compte est anonymisé (identité effacée, dossiers et historique financier conservés tels qu’exigés par la réglementation).</p></div></div>
    </section>
  </main><footer className={portal.footer}>FODIP Digital 2030 · Droits des personnes</footer></div>;
}
