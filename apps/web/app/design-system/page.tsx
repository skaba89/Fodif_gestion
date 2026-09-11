import type { Metadata } from 'next';
import Link from 'next/link';
import ThemeToggle from '../_shared/ThemeToggle';
import portal from '../entrepreneur/portal.module.css';
import SharedUiShowcase from './SharedUiShowcase';
import ds from './design-system.module.css';

export const metadata: Metadata = {
  title: 'Design system — FODIP Digital 2030',
  description: 'Référence vivante des tokens et composants institutionnels FODIP Digital 2030.',
};

const brandTokens = [
  { name: 'Vert primaire', token: '--fodip-primary', value: '#14532D' },
  { name: 'Vert accent', token: '--fodip-accent', value: '#16A34A' },
  { name: 'Or — actions clés', token: '--fodip-gold', value: '#F5B700' },
  { name: 'Fond ivoire', token: '--fodip-ivory', value: '#FAF9F6' },
  { name: 'Texte', token: '--fodip-text', value: '#1A2E22' },
];

const semanticTokens = [
  { name: 'Succès', varName: '--success', soft: '--success-soft' },
  { name: 'Information', varName: '--info', soft: '--info-soft' },
  { name: 'Attention', varName: '--warning', soft: '--warning-soft' },
  { name: 'Critique', varName: '--danger', soft: '--danger-soft' },
];

const componentNames = [
  'Button', 'StatusBadge', 'WorkflowStepper', 'ResponsiveTable', 'FilterBar', 'KpiCard',
  'Toast', 'Dialog', 'ConfirmDialog', 'Breadcrumbs', 'Skeleton', 'EmptyState', 'ErrorState',
  'ExecutiveAlert', 'Drawer', 'ConnectivityBanner', 'InstitutionalIllustration',
  'DisbursementCurve', 'PortfolioDonut', 'GuineaRegionMap',
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
          <p className={portal.eyebrow}>FODIP Digital 2030 — système produit unifié</p>
          <h1 className={portal.title}>Design system institutionnel</h1>
          <p className={portal.lead}>
            La plateforme applique un langage visuel d’institution financière numérique : 60 % ivoire, 30 % surfaces blanches et 10 % vert profond/or, avec une typographie display expressive, des chiffres financiers tabulaires et des primitives SVG sans dépendance graphique lourde.
          </p>
        </div>

        <ul className={ds.toc}>
          <li><a href="#identite">Identité &amp; tokens</a></li>
          <li><a href="#typographie">Typographie &amp; données</a></li>
          <li><a href="#catalogue">Composants partagés</a></li>
          <li><a href="#accessibilite">Accessibilité &amp; mouvement</a></li>
        </ul>

        <section id="identite" className={ds.section}>
          <h2>Identité &amp; tokens</h2>
          <p className={ds.sectionLead}>
            Le contrat de marque est défini dans <code>fodip-product-theme.css</code>. Les anciens alias du produit sont remappés sur ces valeurs pour harmoniser les écrans existants sans dupliquer un second thème.
          </p>
          <div className={ds.swatchGrid}>
            {brandTokens.map((token) => (
              <div className={ds.swatch} key={token.token}>
                <div className={ds.swatchColor} style={{ background: `var(${token.token})`, borderBottom: '1px solid var(--line)' }} />
                <div className={ds.swatchLabel}><strong>{token.name}</strong><code>{token.value} · {token.token}</code></div>
              </div>
            ))}
          </div>

          <h3 style={{ marginTop: 24 }}>Sémantiques</h3>
          <div className={ds.swatchGrid}>
            {semanticTokens.map((token) => (
              <div className={ds.swatch} key={token.varName}>
                <div className={ds.swatchColor} style={{ background: `var(${token.soft})`, color: `var(${token.varName})`, display: 'grid', placeItems: 'center', fontWeight: 800 }}>Aa</div>
                <div className={ds.swatchLabel}><strong>{token.name}</strong><code>{token.varName}</code></div>
              </div>
            ))}
          </div>
          <p className={ds.sectionLead} style={{ marginTop: 18 }}>
            Le mode sombre remappe les mêmes rôles sémantiques ; l’or conserve un texte foncé lorsqu’il sert de fond d’action afin de préserver le contraste.
          </p>
        </section>

        <section id="typographie" className={ds.section}>
          <h2>Typographie &amp; données</h2>
          <p className={ds.sectionLead}>
            <strong>Public Sans</strong> reste la fonte du corps, des formulaires et de la navigation. <strong>Bricolage Grotesque</strong> est réservée aux titres h1/h2, KPI et chiffres clés afin de créer un contraste institutionnel plus mémorable sans compromettre la lisibilité métier.
          </p>
          <div className={ds.typeSpecimen}><p className={portal.eyebrow}>Surtitre institutionnel</p><span className={ds.typeMeta}>Public Sans · caption 0,7 rem · capitales espacées</span></div>
          <div className={ds.typeSpecimen}><h1 className={portal.title} style={{ margin: 0 }}>Financer avec confiance.</h1><span className={ds.typeMeta}>Bricolage Grotesque · display 800 · tracking serré</span></div>
          <div className={ds.typeSpecimen}><p className={portal.lead} style={{ margin: 0 }}>Le corps privilégie la lisibilité des informations métier, y compris sur un écran Android modeste et sous connectivité instable.</p><span className={ds.typeMeta}>Public Sans · corps ≥ 0,8 rem</span></div>
          <div className={ds.typeSpecimen}><strong data-kpi-value style={{ fontSize: 'var(--kpi-size)' }}>45 000 000 000 GNF</strong><span className={ds.typeMeta}>Bricolage Grotesque · chiffres tabulaires · KPI exécutif</span></div>
        </section>

        <section id="catalogue" className={ds.section}>
          <h2>Composants et primitives visuelles</h2>
          <p className={ds.sectionLead}>
            {componentNames.join(' · ')}. Les exemples ci-dessous importent les composants réels de <code>apps/web/app/_shared</code> ; ce catalogue n’est pas une maquette séparée du produit.
          </p>
          <SharedUiShowcase />
        </section>

        <section id="accessibilite" className={ds.section}>
          <h2>Accessibilité, résilience &amp; mouvement</h2>
          <ul>
            <li><code>&lt;html lang=&quot;fr&quot;&gt;</code>, lien d’évitement, focus visible et navigation clavier.</li>
            <li>Cibles tactiles d’au moins 44 px dans les contrôles partagés et navigation mobile avec safe areas iOS.</li>
            <li>Contrastes sémantiques conçus pour AA en clair et en sombre ; les statuts gardent toujours un libellé textuel.</li>
            <li>Transitions produit de 220 ms et count-up KPI de 800 ms, tous deux neutralisés par <code>prefers-reduced-motion</code>.</li>
            <li>Les dataviz SVG utilisent uniquement les tokens du thème et conservent un titre accessible.</li>
            <li>Skeletons et barres de progression remplacent les spinners de chargement.</li>
            <li>Le service worker cache le shell statique mais pas les réponses API financières/PII ; les actions sensibles ne sont jamais mises en file hors ligne silencieusement.</li>
            <li>Les tests Axe couvrent les garde-fous WCAG 2.0/2.1 et les règles WCAG 2.2 AA supportées, avec parcours Playwright desktop et mobile.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
