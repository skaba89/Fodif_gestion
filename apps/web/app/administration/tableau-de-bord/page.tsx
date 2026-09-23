'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Breadcrumbs from '../../_shared/Breadcrumbs';
import KpiCard from '../../_shared/KpiCard';
import role from '../../_shared/RoleDashboard.module.css';
import portal from '../../entrepreneur/portal.module.css';

type Summary = {
  totalUsers: number; activeUsers: number; inactiveUsers: number; mfaRequiredUsers: number;
  neverLoggedInUsers: number; anonymizedUsers: number; enterprises: number; partnerBanks: number;
};

const EMPTY: Summary = { totalUsers: 0, activeUsers: 0, inactiveUsers: 0, mfaRequiredUsers: 0, neverLoggedInUsers: 0, anonymizedUsers: 0, enterprises: 0, partnerBanks: 0 };

export default function AdministrationDashboardPage() {
  const [summary, setSummary] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/administration/summary', { cache: 'no-store' }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message ?? 'Chargement du tableau de bord impossible');
      if (active) setSummary(body);
    }).catch((error) => { if (active) setMessage(error instanceof Error ? error.message : 'Chargement impossible'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <main className={portal.main} aria-busy={loading}>
    <Breadcrumbs items={[{ label: 'Administration', href: '/administration/tableau-de-bord' }, { label: 'Tableau de bord' }]} />
    <div className={role.pageHeader}><div>
      <p className={portal.eyebrow}>Gouvernance des accès</p>
      <h1 className={portal.title}>Tableau de bord Administration</h1>
      <p className={portal.lead}>Pilotez les comptes, les exigences MFA, les organisations rattachées et les actions sensibles à partir des données réelles.</p>
    </div></div>
    {message ? <div className={portal.notice} role="status">{message}</div> : null}
    <section className={role.kpiGrid} aria-label="Synthèse de l’administration">
      <KpiCard label="Comptes actifs" value={String(summary.activeUsers)} definition={`${summary.totalUsers} comptes enregistrés au total.`} />
      <KpiCard label="Comptes inactifs" value={String(summary.inactiveUsers)} definition="Comptes désactivés, sans accès à la plateforme." goodDirection="down" />
      <KpiCard label="MFA exigé" value={String(summary.mfaRequiredUsers)} definition="Comptes soumis à la double authentification institutionnelle." />
      <KpiCard label="Jamais connectés" value={String(summary.neverLoggedInUsers)} definition="Comptes actifs dont la première connexion reste à effectuer." goodDirection="down" />
    </section>
    <section className={`${role.sectionGrid} ${portal.section}`} aria-label="Actions d’administration">
      <article className={role.contextCard}><h2>Cycle de vie des comptes</h2><p>{summary.enterprises} PME et {summary.partnerBanks} banques partenaires sont disponibles pour les rattachements.</p><div className={portal.buttonRow}><Link className={portal.primary} href="/administration/utilisateurs">Gérer les utilisateurs</Link><Link className={portal.secondary} href="/administration/recuperation">Récupérer un compte</Link></div></article>
      <aside className={role.contextCard}><h2>Traçabilité</h2><p>Consultez les créations, modifications, désactivations et réinitialisations enregistrées dans le journal immuable.</p><p><strong>{summary.anonymizedUsers}</strong> compte{summary.anonymizedUsers > 1 ? 's' : ''} anonymisé{summary.anonymizedUsers > 1 ? 's' : ''}.</p><div className={portal.buttonRow}><Link className={portal.secondary} href="/administration/journal">Ouvrir le journal</Link></div></aside>
    </section>
  </main>;
}
