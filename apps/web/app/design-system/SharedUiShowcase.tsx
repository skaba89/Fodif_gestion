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
import { useToast } from '../_shared/Toast';
import styles from './SharedUiShowcase.module.css';

type ExampleRow = {
  id: string;
  dossier: string;
  programme: string;
  statut: string;
};

const SAMPLE_ROWS: ExampleRow[] = [
  { id: 'a', dossier: 'Exemple A', programme: 'Programme de démonstration', statut: 'En instruction' },
  { id: 'b', dossier: 'Exemple B', programme: 'Programme de démonstration', statut: 'Prêt comité' },
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
    { key: 'statut', header: 'Statut', render: (row) => row.statut },
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
        <p className={styles.lead}>Variantes institutionnelles partagées, avec cibles tactiles de 44 px et états désactivé/chargement.</p>
        <div className={styles.row}>
          <Button>Primaire</Button>
          <Button variant="secondary">Secondaire</Button>
          <Button variant="outline">Contour</Button>
          <Button variant="ghost">Discret</Button>
          <Button variant="destructive">Destructif</Button>
          <Button disabled>Désactivé</Button>
          <Button loading>Chargement</Button>
          <Button iconOnly ariaLabel="Ajouter un élément" title="Ajouter">+</Button>
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
        <p className={styles.lead}>Tableau sur écran large ; cartes avec les mêmes colonnes et libellés sous 720 px.</p>
        <ResponsiveTable rows={SAMPLE_ROWS} columns={columns} rowKey={(row) => row.id} caption="Exemple de tableau institutionnel" />
      </section>

      <section className={styles.group} id="shared-existing-components">
        <h3>Composants partagés déjà en service</h3>
        <div className={styles.grid}>
          <KpiCard label="KPI d’exemple" value="—" unit="" definition="Composant de démonstration du design system, sans donnée métier réelle." />
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
        message="Ce spécimen vérifie que le ConfirmDialog historique reste disponible sans régression."
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          pushToast({ tone: 'info', title: 'Confirmation reçue', message: 'Le composant ConfirmDialog est opérationnel.' });
        }}
      />

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Drawer partagé">
        <nav className={styles.drawerLinks} aria-label="Exemple de navigation dans le tiroir">
          <Link href="#shared-buttons" onClick={() => setDrawerOpen(false)}>Boutons</Link>
          <Link href="#shared-filters" onClick={() => setDrawerOpen(false)}>Filtres</Link>
          <Link href="#shared-responsive-table" onClick={() => setDrawerOpen(false)}>Tableaux responsives</Link>
        </nav>
      </Drawer>
    </div>
  );
}
