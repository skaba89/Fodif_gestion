import ProgramCatalog from '../../_shared/ProgramCatalog';
import ProgramProposalPanel from '../../_shared/ProgramProposalPanel';

export default function AgentProgramsPage() {
  return <>
    <ProgramCatalog eyebrow="Référentiel programmes" title="Programmes FODIP actifs" homeHref="/agent/dossiers" homeLabel="Agent" />
    <ProgramProposalPanel />
  </>;
}
