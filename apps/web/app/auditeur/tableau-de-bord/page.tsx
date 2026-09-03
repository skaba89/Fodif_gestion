'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Pagination from '../../_shared/Pagination';
import portal from '../../entrepreneur/portal.module.css';
import styles from '../../agent/agent.module.css';

type Financing = {
  id: string; numeroFinancement: string; numeroDossier: string; raisonSociale: string; region?: string;
  montantAccorde: number; montantDecaisse: number; montantRembourse: number; impaye: number; statut: string;
};
type FinancingsResult = { items: Financing[]; total: number; page: number; limite: number };

type AuditLog = {
  id: string; action: string; entityType: string; entityId: string | null; createdAt: string;
  actorEmail?: string | null; actorNom?: string | null; actorPrenom?: string | null;
};
type AuditResult = { items: AuditLog[]; total: number; page: number; limite: number };

const ENTITY_TYPES = ['DOSSIER_FINANCEMENT', 'DOSSIER_DOCUMENT', 'FINANCEMENT', 'DECAISSEMENT', 'REMBOURSEMENT', 'SUIVI_IMPACT', 'UTILISATEUR'];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function AuditeurDashboardPage() {
  const [financings, setFinancings] = useState<FinancingsResult>({ items: [], total: 0, page: 1, limite: 25 });
  const [logs, setLogs] = useState<AuditResult>({ items: [], total: 0, page: 1, limite: 25 });
  const [entityType, setEntityType] = useState('');
  const [message, setMessage] = useState('');

  const loadFinancings = useCallback((page: number) => {
    fetch(`/api/auditeur/financements?page=${page}`, { cache: 'no-store' }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message ?? 'Chargement des financements impossible');
      setFinancings(body);
    }).catch((error) => setMessage(error.message));
  }, []);

  const loadLogs = useCallback((page: number, filterEntityType = entityType) => {
    const query = new URLSearchParams({ page: String(page) });
    if (filterEntityType) query.set('entityType', filterEntityType);
    fetch(`/api/auditeur/journal?${query}`, { cache: 'no-store' }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message ?? 'Chargement du journal impossible');
      setLogs(body);
    }).catch((error) => setMessage(error.message));
  }, [entityType]);

  useEffect(() => { loadFinancings(1); loadLogs(1); }, [loadFinancings, loadLogs]);

  function filterLogs(event: FormEvent) { event.preventDefault(); setMessage(''); loadLogs(1); }

  const committed = financings.items.reduce((sum, item) => sum + item.montantAccorde, 0);
  const disbursed = financings.items.reduce((sum, item) => sum + item.montantDecaisse, 0);
  const impayes = financings.items.reduce((sum, item) => sum + item.impaye, 0);

  return <main className={portal.main}>
    <p className={portal.eyebrow}>Contrôle indépendant</p><h1 className={portal.title}>Supervision et audit</h1>
    <p className={portal.lead}>Consultation en lecture seule du portefeuille de financements et du journal d'audit — aucune action de modification n'est disponible depuis cet espace.</p>

    <section className={styles.metrics}>
      <article className={`${portal.card} ${styles.metric}`}><strong>{financings.total}</strong><span>Financements</span></article>
      <article className={`${portal.card} ${styles.metric}`}><strong>{committed.toLocaleString('fr-FR')}</strong><span>GNF accordés (page)</span></article>
      <article className={`${portal.card} ${styles.metric}`}><strong>{disbursed.toLocaleString('fr-FR')}</strong><span>GNF décaissés (page)</span></article>
      <article className={`${portal.card} ${styles.metric}`}><strong>{impayes.toLocaleString('fr-FR')}</strong><span>GNF impayés (page)</span></article>
    </section>
    {message && <div className={portal.notice} role="status">{message}</div>}

    <section className={`${portal.card} ${portal.tableCard} ${portal.section}`} tabIndex={0} role="region" aria-label="Tableau, défilement horizontal sur petit écran">
      <div className={portal.sectionHeader}><div><h2>Portefeuille de financements</h2><p>Vue consolidée, identique à celle de la Direction, sans droit de création ni de modification.</p></div></div>
      <table className={portal.table}><thead><tr><th>Financement</th><th>Entreprise</th><th>Accordé</th><th>Décaissé</th><th>Remboursé</th><th>Impayé</th><th>Statut</th></tr></thead><tbody>{financings.items.map((item) => <tr key={item.id}><td><strong>{item.numeroFinancement}</strong><br />{item.numeroDossier}</td><td>{item.raisonSociale}<br />{item.region ?? '—'}</td><td>{item.montantAccorde.toLocaleString('fr-FR')} GNF</td><td>{item.montantDecaisse.toLocaleString('fr-FR')} GNF</td><td>{item.montantRembourse.toLocaleString('fr-FR')} GNF</td><td>{item.impaye.toLocaleString('fr-FR')} GNF</td><td><span className={portal.pill}>{item.statut}</span></td></tr>)}</tbody></table>
      {financings.items.length === 0 && <p className={portal.lead}>Aucun financement enregistré.</p>}
      <Pagination page={financings.page} limite={financings.limite} total={financings.total} onChange={loadFinancings} buttonClassName={portal.secondary} rowClassName={portal.buttonRow} />
    </section>

    <section className={`${portal.card} ${portal.tableCard} ${portal.section}`} tabIndex={0} role="region" aria-label="Tableau, défilement horizontal sur petit écran">
      <div className={portal.sectionHeader}><div><h2>Journal d'audit</h2><p>Toute action journalisée par la plateforme — instruction, décision de comité, gestion des comptes, opérations de financement.</p></div></div>
      <form className={styles.filters} onSubmit={filterLogs}>
        <div className={styles.filter}><label htmlFor="entityType">Type d'entité</label><select id="entityType" value={entityType} onChange={(event) => setEntityType(event.target.value)}><option value="">Tous</option>{ENTITY_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></div>
        <button className={portal.primary}>Filtrer</button>
      </form>
      <table className={portal.table}><thead><tr><th>Date</th><th>Auteur</th><th>Action</th><th>Entité</th></tr></thead><tbody>{logs.items.map((log) => <tr key={log.id}><td>{formatDate(log.createdAt)}</td><td>{log.actorEmail ?? 'Système'}</td><td><span className={portal.pill}>{log.action}</span></td><td>{log.entityType}{log.entityId ? ` · ${log.entityId.slice(0, 8)}…` : ''}</td></tr>)}</tbody></table>
      {logs.items.length === 0 && <p className={portal.lead}>Aucune trace d'audit ne correspond aux critères.</p>}
      <Pagination page={logs.page} limite={logs.limite} total={logs.total} onChange={(page) => loadLogs(page)} buttonClassName={portal.secondary} rowClassName={portal.buttonRow} />
    </section>
  </main>;
}
