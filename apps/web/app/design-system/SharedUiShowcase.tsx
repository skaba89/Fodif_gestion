'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Breadcrumbs from '../_shared/Breadcrumbs';
import Button from '../_shared/Button';
import ConfirmDialog from '../_shared/ConfirmDialog';
import Dialog from '../_shared/Dialog';
import Drawer from '../_shared/Drawer';
import EmptyState from '../_shared/EmptyState';
import ErrorState from '../_shared/ErrorState';
import ExecutiveAlert from '../_shared/ExecutiveAlert';
import FilterBar, { FilterField } from '../_shared/FilterBar';
import KpiCard from '../_shared/KpiCard';
import ResponsiveTable, { type ResponsiveColumn } from '../_shared/ResponsiveTable';
import Skeleton from '../_shared/Skeleton';
import StatusBadge, { DossierStatusBadge } from '../_shared/StatusBadge';
import { useToast } from '../_shared/Toast';
import WorkflowStepper from '../_shared/WorkflowStepper';
import styles from './SharedUiShowcase.module.css';

type ExampleRow = {
  id: string;
  dossier: string;
  programme: string;
  statut: string;
};

const SAMPLE_ROWS: ExampleRow[] = [
  { id: 'a', dossier: 'FODIP-2030-001', programme: 'Croissance PME', statut: 'EN_INSTRUCTION' },
  { id: 'b', dossier: 'FODIP-2030-002', programme: 'Industrialisation', statut: 'PRET_COMITE' },
];

const WORKFLOW = [
  { label: 'Dossier', description: 'Dépôt et pièces' },
  { label: 'Instruction', description: 'Analyse FODIP' },
  { label: 'Décision', description: 'Comité' },
  { label: 'Financement', description: 'Décaissement' },
  { label: 'Suivi', description: 'Impact' },
];

export default function SharedUiShowcase() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const { pushToast } = useToast();

  const columns = useMemo<ResponsiveColumn<ExampleRow>[]>(() => [
    { key: 'dossier', header: 'Dossier', render: (row) => <strong>{row.dossier}</strong> },
    { key: 'programme', header: 'Programme', render: (row) => row.programme },
    { key: 'statut', header: 'Statut', render: (row) => <DossierStatusBadge status={row.statut} /> },
    { key: 'action', header: 'Action', render: () => <Button variant="outline" href="/design-system">Ouvrir</Button> },
  ], []);

  const activeCount = Number(Boolean(search.trim())) + Number(Boolean(status));

  return (
    <div className={styles.stack} data-testid="shared-ui-showcase">
      <section className={styles.group} id="shared-breadcrumbs">
        <h3>Breadcrumbs</h3>
        <Breadcrumbs items={[
          { label: 'Direction', href: '/direction/tableau-de-bord' },
          { label: 'Financements', href: '/direction/financements' },
          { label: 'Dossier d’exemple' },
        ]} />
      </section>

      <section className={styles.group} id="shared-buttons">
        <h3>Button</h3>
        <p className={styles.lead}>Trois niveaux principaux plus états destructif, discret et chargement. Les cibles tactiles font au moins 44 px et le chargement utilise une barre linéaire, jamais un spinner.</p>
        <div className={styles.row}>
          <Button>Primaire</Button>
          <Button variant="secondary">Action clé or</Button>
          <Button variant="outline">Secondaire</Button>
          <Button variant="ghost">Discret</Button>
          <Button variant="destructive">Destructif</Button>
          <Button disabled>Désactivé</Button>
          <Button loading>Chargement</Button>
          <Button iconOnly ariaLabel="Ajouter un élément" title="Ajouter">+</Button>
        </div>
      </section>

      <section className={styles.group} id="shared-statuses">
        <h3>StatusBadge</h3>
        <p className={styles.lead}>Les statuts sont lisibles par texte et couleur sémantique : la couleur n’est jamais la seule information.</p>
        <div className={styles.row}>
          <DossierStatusBadge status="BROUILLON" />
          <DossierStatusBadge status="SOUMIS" />
          <DossierStatusBadge status="EN_INSTRUCTION" />
          <DossierStatusBadge status="PRET_COMITE" />
          <DossierStatusBadge status="APPROUVE" />
          <DossierStatusBadge status="REJETE" />
          <StatusBadge label="Financé" tone="success" />
          <StatusBadge label="Remboursé" tone="success" />
        </div>
      </section>

      <section className={styles.group} id="shared-workflow">
        <h3>WorkflowStepper</h3>
        <p className={styles.lead}>La chaîne de valeur de la landing devient un composant produit : horizontale sur desktop, verticale sur mobile, avec étape courante annoncée par <code>aria-current</code>.</p>
        <div className={styles.surface}>
          <WorkflowStepper steps={WORKFLOW} currentIndex={1} />
        </div>
      </section>

      <section className={styles.group} id="shared-feedback">
        <h3>Toast, Dialog &amp; ConfirmDialog</h3>
        <div className={styles.row}>
          <Button
            variant="outline"
            onClick={() => pushToast({ tone: 'success', title: 'Action enregistrée', message: 'Exemple de confirmation utilisateur sans détail technique.' })}
          >
            Afficher un toast
          </Button>
          <Button variant="outline" onClick={() => setDialogOpen(true)}>Ouvrir Dialog</Button>
          <Button variant="outline" onClick={() => setConfirmOpen(true)}>Ouvrir ConfirmDialog</Button>
        </div>
      </section>

      <section className={styles.group} id="shared-filters">
        <h3>FilterBar</h3>
        <FilterBar
          activeCount={activeCount}
          onReset={() => { setSearch(''); setStatus(''); }}
          actions={<Button variant="primary">Appliquer</Button>}
        >
          <FilterField label="Recherche" htmlFor="ds-shared-search">
            <input id="ds-shared-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="N° dossier ou PME" />
          </FilterField>
          <FilterField label="Statut" htmlFor="ds-shared-status">
            <select id="ds-shared-status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Tous les statuts</option>
              <option value="instruction">En instruction</option>
              <option value="comite">Prêt comité</option>
            </select>
          </FilterField>
          <FilterField label="Région" htmlFor="ds-shared-region">
            <select id="ds-shared-region" defaultValue="">
              <option value="">Toutes les régions</option>
              <option value="exemple">Valeur d’exemple</option>
            </select>
          </FilterField>
        </FilterBar>
      </section>

      <section className={styles.group} id="shared-responsive-table">
        <h3>ResponsiveTable</h3>
        <p className={styles.lead}>Tableau sémantique sur écran large ; cartes libellées contenant les mêmes données sous 720 px. Les écrans paginés limitent actuellement le rendu à 25 lignes.</p>
        <ResponsiveTable rows={SAMPLE_ROWS} columns={columns} rowKey={(row) => row.id} caption="Exemple de tableau institutionnel" />
      </section>

      <section className={styles.group} id="shared-existing-components">
        <h3>Composants de données, chargement et états</h3>
        <div className={styles.grid}>
          <KpiCard label="KPI d’exemple" value="45" unit="Mds GNF" definition="Composant de démonstration du design system, sans donnée métier réelle." />
          <div className={styles.surface}><Skeleton lines={2} /></div>
          <EmptyState title="État vide" message="Exemple de liste ne contenant aucune donnée." actionHref="/design-system" actionLabel="Action" />
          <ErrorState message="Exemple d’état d’erreur utilisateur sans détail technique." />
        </div>
        <ul className={styles.alertList}>
          <ExecutiveAlert alert={{
            id: 'design-system-example',
            severite: 'attention',
            titre: 'Exemple de point d’attention',
            explication: 'Spécimen visuel du composant ; aucune donnée réelle n’est utilisée.',
            dossiers: 0,
            montant: null,
            action: 'Examiner le périmètre concerné.',
            lien: '/design-system',
          }} />
        </ul>
        <div className={styles.row}>
          <Button variant="outline" onClick={() => setDrawerOpen(true)}>Ouvrir Drawer</Button>
        </div>
      </section>

      <section className={styles.group} id="shared-connectivity">
        <h3>ConnectivityBanner</h3>
        <p className={styles.lead}>Composant global du shell : il n’apparaît que lors d’une perte de réseau ou pendant les quatre secondes suivant la reconnexion. Les mutations sensibles restent désactivées hors ligne au lieu d’être mises en file silencieusement.</p>
      </section>

      <Dialog
        open={dialogOpen}
        title="Dialog institutionnel"
        description="Exemple de fenêtre modale générique accessible."
        onClose={() => setDialogOpen(false)}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => setDialogOpen(false)}>Continuer</Button>
          </>
        )}
      >
        <div className={styles.dialogBody}>
          <p>Le focus reste contenu dans la fenêtre, Escape ferme la modale et le focus revient au déclencheur.</p>
          <label htmlFor="ds-dialog-note">Note d’exemple</label>
          <input id="ds-dialog-note" placeholder="Saisissez une note" />
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirmer l’action"
        message="Ce spécimen vérifie qu’une action sensible peut demander une confirmation explicite avant exécution."
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          pushToast({ tone: 'info', title: 'Confirmation reçue', message: 'Le composant ConfirmDialog est opérationnel.' });
        }}
      />

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Drawer partagé">
        <nav className={styles.drawerLinks} aria-label="Exemple de navigation dans le tiroir">
          <Link href="#shared-buttons" onClick={() => setDrawerOpen(false)}>Boutons</Link>
          <Link href="#shared-statuses" onClick={() => setDrawerOpen(false)}>Statuts</Link>
          <Link href="#shared-workflow" onClick={() => setDrawerOpen(false)}>Workflow</Link>
          <Link href="#shared-responsive-table" onClick={() => setDrawerOpen(false)}>Tableaux responsives</Link>
        </nav>
      </Drawer>
    </div>
  );
}
