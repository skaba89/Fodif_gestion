import type { Metadata } from 'next';
import Link from 'next/link';
import ThemeToggle from '../_shared/ThemeToggle';
import portal from '../entrepreneur/portal.module.css';
import ds from './design-system.module.css';

export const metadata: Metadata = {
  title: 'Design system — FODIP Digital 2030',
  description: 'Référence des jetons de conception et des composants partagés (axe A5).',
};

const primaryScale = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
const accentScale = ['100', '300', '500', '600', '700'];
const neutralScale = ['0', '50', '100', '200', '300', '500', '700', '900'];

const semanticTokens = [
  { name: 'Fond de page', varName: '--bg' },
  { name: 'Surface (carte)', varName: '--surface' },
  { name: 'Surface adoucie', varName: '--surface-soft' },
  { name: 'Texte principal', varName: '--ink', text: true },
  { name: 'Texte atténué', varName: '--muted', text: true },
  { name: 'Séparateur', varName: '--line' },
];

const statusTokens = [
  { name: 'Succès', varName: '--success', soft: '--success-soft' },
  { name: 'Information', varName: '--info', soft: '--info-soft' },
  { name: 'Avertissement', varName: '--warning', soft: '--warning-soft' },
  { name: 'Danger', varName: '--danger', soft: '--danger-soft' },
];

const toc = [
  ['#palette', 'Palette & contrastes'],
  ['#typographie', 'Typographie'],
  ['#boutons', 'Boutons'],
  ['#formulaires', 'Formulaires'],
  ['#cartes', 'Cartes & tableaux'],
  ['#badges', 'Badges de statut'],
  ['#messages', 'Messages'],
  ['#accessibilite', 'Accessibilité'],
];

export default function DesignSystemPage() {
  return (
    <div className={ds.shell}>
      <a href="#main-content" className="skip-link">Aller au contenu principal</a>
      <header className={ds.header}>
        <Link href="/" className={ds.brand}><span>FD</span><span>Design system</span></Link>
        <div className={portal.headerActions}><ThemeToggle buttonClassName={portal.themeToggle} /></div>
      </header>

      <main id="main-content" tabIndex={-1} className={ds.main}>
        <div className={ds.intro}>
          <p className={portal.eyebrow}>Axe A5 — docs/14-ROADMAP-SAAS-PREMIUM.md</p>
          <h1 className={portal.title}>Design system FODIP Digital 2030</h1>
          <p className={portal.lead}>
            Référence vivante des jetons de conception et des composants partagés entre les sept portails :
            chaque exemple ci-dessous utilise les mêmes feuilles de style que le produit
            (<code>globals.css</code>, <code>entrepreneur/portal.module.css</code>), pas une recopie — une
            évolution d’un jeton ou d’une classe se reflète ici automatiquement. Sert de repère de cohérence à
            mesure que l’équipe grandit, en complément (plus léger qu’un Storybook complet) du choix fait pour
            cet axe.
          </p>
        </div>

        <ul className={ds.toc}>
          {toc.map(([href, label]) => <li key={href}><a href={href}>{label}</a></li>)}
        </ul>

        <section id="palette" className={ds.section}>
          <h2>Palette &amp; contrastes</h2>
          <p className={ds.sectionLead}>
            Échelle primaire (vert forêt), échelle accent (or) et échelle neutre — voir
            <code> globals.css</code>. Chaque paire texte/fond utilisée dans le produit est vérifiée AA
            (4.5:1) en clair et en sombre (axe A6) ; deux écarts réels ont été trouvés et corrigés cette
            itération, dont un jeton d’avertissement jamais redéfini pour le mode sombre — voir le détail
            « A6, suite et clôture » dans la feuille de route.
          </p>
          <h3>Primaire</h3>
          <div className={ds.swatchGrid}>
            {primaryScale.map((step) => (
              <div className={ds.swatch} key={step}>
                <div className={ds.swatchColor} style={{ background: `var(--primary-${step})` }} />
                <div className={ds.swatchLabel}><strong>primary-{step}</strong><code>--primary-{step}</code></div>
              </div>
            ))}
          </div>
          <h3 style={{ marginTop: 20 }}>Accent</h3>
          <div className={ds.swatchGrid}>
            {accentScale.map((step) => (
              <div className={ds.swatch} key={step}>
                <div className={ds.swatchColor} style={{ background: `var(--accent-${step})` }} />
                <div className={ds.swatchLabel}><strong>accent-{step}</strong><code>--accent-{step}</code></div>
              </div>
            ))}
          </div>
          <h3 style={{ marginTop: 20 }}>Neutre</h3>
          <div className={ds.swatchGrid}>
            {neutralScale.map((step) => (
              <div className={ds.swatch} key={step}>
                <div className={ds.swatchColor} style={{ background: `var(--neutral-${step})`, borderBottom: '1px solid var(--line)' }} />
                <div className={ds.swatchLabel}><strong>neutral-{step}</strong><code>--neutral-{step}</code></div>
              </div>
            ))}
          </div>
          <h3 style={{ marginTop: 20 }}>Jetons sémantiques</h3>
          <div className={ds.swatchGrid}>
            {semanticTokens.map((token) => (
              <div className={ds.swatch} key={token.varName}>
                <div
                  className={ds.swatchColor}
                  style={token.text
                    ? { background: 'var(--surface)', color: `var(${token.varName})`, display: 'grid', placeItems: 'center', fontWeight: 800 }
                    : { background: `var(${token.varName})`, borderBottom: '1px solid var(--line)' }}
                >
                  {token.text ? 'Aa' : null}
                </div>
                <div className={ds.swatchLabel}><strong>{token.name}</strong><code>{token.varName}</code></div>
              </div>
            ))}
          </div>
          <h3 style={{ marginTop: 20 }}>États (succès, information, avertissement, danger)</h3>
          <div className={ds.swatchGrid}>
            {statusTokens.map((token) => (
              <div className={ds.swatch} key={token.varName}>
                <div
                  className={ds.swatchColor}
                  style={{ background: `var(${token.soft})`, color: `var(${token.varName})`, display: 'grid', placeItems: 'center', fontWeight: 800 }}
                >
                  Aa
                </div>
                <div className={ds.swatchLabel}><strong>{token.name}</strong><code>{token.varName}</code></div>
              </div>
            ))}
          </div>
        </section>

        <section id="typographie" className={ds.section}>
          <h2>Typographie</h2>
          <p className={ds.sectionLead}>Public Sans (auto-hébergée, axe A1), la même famille que le design system gouvernemental américain USWDS.</p>
          <div className={ds.typeSpecimen}><p className={portal.eyebrow}>Surtitre — .eyebrow</p><span className={ds.typeMeta}>0.68rem, majuscules, gras 800</span></div>
          <div className={ds.typeSpecimen}><h1 className={portal.title} style={{ margin: 0 }}>Titre de page — h1 / .title</h1><span className={ds.typeMeta}>clamp(1.65rem, 2.5vw, 2.25rem)</span></div>
          <div className={ds.typeSpecimen}><h2 style={{ margin: 0 }}>Titre de section — h2</h2><span className={ds.typeMeta}>clamp(2rem, 4vw, 3.3rem) sur les pages produit ; réduit ici pour la lisibilité de cette page de référence</span></div>
          <div className={ds.typeSpecimen}><h3 style={{ margin: 0 }}>Titre de carte — h3</h3><span className={ds.typeMeta}>1.1rem</span></div>
          <div className={ds.typeSpecimen}><p className={portal.lead} style={{ margin: 0 }}>Texte d’introduction — .lead : présente le contenu d’une page ou d’une section.</p></div>
        </section>

        <section id="boutons" className={ds.section}>
          <h2>Boutons</h2>
          <p className={ds.sectionLead}>États <code>:hover</code>/<code>:focus-visible</code>/<code>:disabled</code> cohérents (axe A2) — testez la navigation au clavier (Tab) pour voir l’anneau de focus.</p>
          <div className={ds.exampleRow}>
            <button className={portal.primary} type="button">Action principale — .primary</button>
            <button className={portal.secondary} type="button">Action secondaire — .secondary</button>
            <button className="secondary-button" type="button">Bouton neutre — .secondary-button</button>
            <button className="text-button" type="button">Lien d’action — .text-button</button>
            <button className={portal.secondary} type="button" disabled>Désactivé</button>
          </div>
        </section>

        <section id="formulaires" className={ds.section}>
          <h2>Formulaires</h2>
          <p className={ds.sectionLead}>
            Chaque champ associe son étiquette par <code>htmlFor</code>/<code>id</code> — le défaut trouvé et
            corrigé sur 19 champs répartis sur 8 pages lors de l’écriture des tests e2e (axe A6/C2b) : sans
            cette association, un lecteur d’écran ne peut pas annoncer le nom du champ.
          </p>
          <div className={`${portal.card} ${portal.formCard}`}>
            <div className={portal.formGrid}>
              <div className={portal.field}><label htmlFor="ds-text">Champ texte</label><input id="ds-text" placeholder="Saisissez une valeur" /></div>
              <div className={portal.field}><label htmlFor="ds-select">Champ liste</label><select id="ds-select"><option>Option A</option><option>Option B</option></select></div>
            </div>
          </div>
        </section>

        <section id="cartes" className={ds.section}>
          <h2>Cartes &amp; tableaux</h2>
          <div className={`${portal.card} ${ds.specimen}`}>
            <p className={ds.typeMeta}>.card</p>
            <p style={{ margin: 0 }}>Conteneur de base : fond, bordure, ombre légère, coins arrondis.</p>
          </div>
          <div className={`${portal.card} ${portal.tableCard}`} tabIndex={0} role="region" aria-label="Tableau, défilement horizontal sur petit écran">
            <table className={portal.table}>
              <thead><tr><th>Dossier</th><th>Montant</th><th>Statut</th></tr></thead>
              <tbody>
                <tr><td>FODIP-2026-000042</td><td>500 000 000 GNF</td><td><span className={`${portal.status} ${portal.statusOk}`}>APPROUVE</span></td></tr>
                <tr><td>FODIP-2026-000043</td><td>120 000 000 GNF</td><td><span className={portal.status}>EN_INSTRUCTION</span></td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="badges" className={ds.section}>
          <h2>Badges de statut</h2>
          <div className={ds.exampleRow}>
            <span className={portal.status}>.status — neutre</span>
            <span className={`${portal.status} ${portal.statusOk}`}>.status .statusOk — succès</span>
            <span className={portal.pill}>.pill — avertissement</span>
          </div>
        </section>

        <section id="messages" className={ds.section}>
          <h2>Messages</h2>
          <div className={`${portal.notice} ${ds.specimen}`} role="status">.notice avec <code>role=&quot;status&quot;</code> — confirmation ou information, annoncé sans interrompre le lecteur d’écran.</div>
          <div className={`${portal.notice} ${ds.specimen}`} role="alert">.notice avec <code>role=&quot;alert&quot;</code> — erreur bloquante, annoncée immédiatement.</div>
        </section>

        <section id="accessibilite" className={ds.section}>
          <h2>Accessibilité (axe A6)</h2>
          <ul>
            <li>Lien d’évitement (<code>.skip-link</code>, en haut de cette page) : appuyez sur Tab dès l’arrivée sur la page pour le voir apparaître.</li>
            <li>Anneau de focus visible (<code>:focus-visible</code>) sur tous les éléments interactifs, jamais l’<code>outline</code> par défaut du navigateur.</li>
            <li>Contrastes texte/fond vérifiés AA (4.5:1) en clair et en sombre pour chaque jeton de la section Palette ci-dessus.</li>
            <li>Scan automatisé WCAG 2.1 A/AA (<code>@axe-core/playwright</code>, <code>apps/web/e2e/accessibility.spec.ts</code>) sur les pages clés du produit à chaque changement.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
