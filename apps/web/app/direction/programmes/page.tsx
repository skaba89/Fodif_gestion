'use client';

import { useEffect, useState } from 'react';
import ProgramCatalog from '../../_shared/ProgramCatalog';
import ProgramProposalPanel from '../../_shared/ProgramProposalPanel';
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
    return <main style={{ padding: '2rem' }}><p>Chargement du référentiel programmes…</p></main>;
  }

  if (roles.includes('DIRECTION_FODIP') || roles.includes('SUPER_ADMIN')) {
    return <ProgramManagement />;
  }

  return <>
    <ProgramCatalog eyebrow="Référentiel programmes" title="Programmes FODIP actifs" homeHref="/direction/tableau-de-bord" homeLabel="Direction" />
    {roles.includes('ANALYSTE') ? <ProgramProposalPanel /> : null}
  </>;
}
