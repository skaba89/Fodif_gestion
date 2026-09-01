const navItems = [
  'Vue nationale',
  'PME',
  'Dossiers',
  'Financements',
  'Décaissements',
  'Impact',
  'Programmes',
  'Partenaires',
  'Audit',
];

const stats = [
  { label: 'PME enregistrées', value: '1 247', delta: '+8,4 %', tone: 'positive' },
  { label: 'Dossiers en cours', value: '163', delta: '27 à analyser', tone: 'neutral' },
  { label: 'Financements approuvés', value: '84,7 Md', suffix: 'GNF', delta: '+12,1 %', tone: 'positive' },
  { label: 'Montants décaissés', value: '61,3 Md', suffix: 'GNF', delta: '72 % approuvés', tone: 'neutral' },
  { label: 'Emplois créés', value: '3 840', delta: '+416 ce trimestre', tone: 'positive' },
  { label: 'Taux de remboursement', value: '91,4 %', delta: 'Objectif 90 %', tone: 'positive' },
];

const regions = [
  { name: 'Conakry', amount: '28,4 Md', pct: 100 },
  { name: 'Kindia', amount: '14,8 Md', pct: 52 },
  { name: 'Boké', amount: '11,2 Md', pct: 39 },
  { name: 'Kankan', amount: '9,7 Md', pct: 34 },
  { name: 'Labé', amount: '7,6 Md', pct: 27 },
  { name: 'Mamou', amount: '5,8 Md', pct: 20 },
  { name: 'Faranah', amount: '4,1 Md', pct: 14 },
  { name: 'Nzérékoré', amount: '3,1 Md', pct: 11 },
];

const pipeline = [
  { label: 'Soumis', value: 74 },
  { label: 'Vérification', value: 31 },
  { label: 'Analyse', value: 27 },
  { label: 'Comité', value: 18 },
  { label: 'Complément', value: 13 },
];

const recentCases = [
  { id: 'FODIP-2026-001845', company: 'Agro Kindia Services', sector: 'Agro-industrie', status: 'Analyse', amount: '480 M GNF' },
  { id: 'FODIP-2026-001844', company: 'Labé Textile SARL', sector: 'Industrie', status: 'Comité', amount: '730 M GNF' },
  { id: 'FODIP-2026-001843', company: 'Kankan Digital', sector: 'Technologie', status: 'Vérification', amount: '215 M GNF' },
  { id: 'FODIP-2026-001842', company: 'Boké Transformation', sector: 'Transformation', status: 'Analyse', amount: '1,2 Md GNF' },
];

export default function DirectionDashboard() {
  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Navigation principale">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">FD</div>
          <div>
            <strong>FODIP</strong>
            <span>Digital 2030</span>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item, index) => (
            <a className={index === 0 ? 'nav-item active' : 'nav-item'} href="#" key={item}>
              <span className="nav-dot" aria-hidden="true" />
              {item}
            </a>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="environment">DIRECTION GÉNÉRALE</span>
          <strong>Portail décisionnel</strong>
          <small>Données de démonstration</small>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Cockpit national</p>
            <h1>Vue d’ensemble</h1>
          </div>
          <div className="topbar-actions">
            <button className="secondary-button">Exporter le rapport</button>
            <button className="profile-button" aria-label="Ouvrir le profil Direction générale">DG</button>
          </div>
        </header>

        <section className="hero-panel">
          <div>
            <span className="hero-kicker">FODIP DIGITAL 2030</span>
            <h2>Piloter l’impact économique des PME guinéennes.</h2>
            <p>
              Une lecture consolidée des dossiers, financements, décaissements et résultats socio-économiques pour accélérer les décisions.
            </p>
          </div>
          <div className="hero-summary">
            <span>Encours suivi</span>
            <strong>47,9 Md GNF</strong>
            <small>Sur l’ensemble des financements actifs</small>
          </div>
        </section>

        <section className="stats-grid" aria-label="Indicateurs clés">
          {stats.map((stat) => (
            <article className="stat-card" key={stat.label}>
              <span>{stat.label}</span>
              <div className="stat-value-row">
                <strong>{stat.value}</strong>
                {stat.suffix && <small>{stat.suffix}</small>}
              </div>
              <em className={stat.tone}>{stat.delta}</em>
            </article>
          ))}
        </section>

        <section className="dashboard-grid">
          <article className="panel region-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Répartition territoriale</p>
                <h3>Financements par région</h3>
              </div>
              <button className="text-button">Voir la carte</button>
            </div>
            <div className="region-list">
              {regions.map((region) => (
                <div className="region-row" key={region.name}>
                  <span>{region.name}</span>
                  <div className="bar-track" aria-hidden="true">
                    <div className="bar-value" style={{ width: `${region.pct}%` }} />
                  </div>
                  <strong>{region.amount}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="panel pipeline-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Instruction</p>
                <h3>Pipeline des dossiers</h3>
              </div>
            </div>
            <div className="pipeline-total">
              <strong>163</strong>
              <span>dossiers actifs</span>
            </div>
            <div className="pipeline-list">
              {pipeline.map((item) => (
                <div className="pipeline-row" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            <div className="attention-box">
              <strong>18 dossiers</strong>
              <span>prêts pour le prochain comité.</span>
            </div>
          </article>
        </section>

        <section className="dashboard-grid lower-grid">
          <article className="panel table-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Activité récente</p>
                <h3>Dossiers prioritaires</h3>
              </div>
              <button className="text-button">Tous les dossiers</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Dossier</th>
                    <th>Entreprise</th>
                    <th>Secteur</th>
                    <th>Statut</th>
                    <th>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCases.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.id}</strong></td>
                      <td>{item.company}</td>
                      <td>{item.sector}</td>
                      <td><span className="status-pill">{item.status}</span></td>
                      <td>{item.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="panel impact-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Impact</p>
                <h3>Résultats clés</h3>
              </div>
            </div>
            <div className="impact-metric">
              <span>Femmes bénéficiaires</span>
              <strong>34 %</strong>
            </div>
            <div className="impact-metric">
              <span>Jeunes bénéficiaires</span>
              <strong>41 %</strong>
            </div>
            <div className="impact-metric">
              <span>Agro-industrie</span>
              <strong>32 %</strong>
            </div>
            <div className="impact-metric">
              <span>PME hors Conakry</span>
              <strong>58 %</strong>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
