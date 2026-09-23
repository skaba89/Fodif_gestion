'use client';

import { useEffect, useState } from 'react';
import Breadcrumbs from '../../_shared/Breadcrumbs';
import ProgramCatalog from '../../_shared/ProgramCatalog';
import ProgramProposalPanel from '../../_shared/ProgramProposalPanel';
import portal from '../../entrepreneur/portal.module.css';
import ProgramManagement from './ProgramManagement';

type Session = { roles?: string[] };

export default function DirectionProgramsPage() {
  const [roles, setRoles] = useState<string[] | null>(null);

  useEffect(() => {
    fetch('/api/session/me', { cache: 'no-store' })
      .then(async (response) => response.ok ? response.json() as Promise<Session> : { roles: [] })
      .then((session) => setRoles(session.roles ?? []))
      .catch(() => setRoles([]));
  }, []);

  if (roles === null) {
    return (
      <main className={portal.main}>
        <Breadcrumbs items={[{ label: 'Direction', href: '/direction/tableau-de-bord' }, { label: 'Programmes' }]} />
        <p className={portal.eyebrow}>Référentiel programmes</p>
        <h1 className={portal.title}>Programmes FODIP</h1>
        <p className={portal.lead} role="status">Chargement du référentiel programmes…</p>
      </main>
    );
  }

  if (roles.includes('DIRECTION_FODIP') || roles.includes('SUPER_ADMIN')) {
    return <ProgramManagement />;
  }

  return (
    <ProgramCatalog eyebrow="Référentiel programmes" title="Programmes FODIP actifs" homeHref="/direction/tableau-de-bord" homeLabel="Direction">
      {roles.includes('ANALYSTE') ? <ProgramProposalPanel /> : null}
    </ProgramCatalog>
  );
}
