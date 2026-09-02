import LoginForm from '../../_shared/LoginForm';

export default function AgentLoginPage() {
  return (
    <LoginForm
      eyebrow="Instruction FODIP"
      title="Connexion Agent"
      lead="Accès réservé aux agents autorisés chargés d’instruire et de vérifier les dossiers."
      redirectTo="/agent/dossiers"
      allowedRoles={['AGENT_FODIP', 'SUPER_ADMIN']}
      deniedMessage="Ce compte ne possède pas le rôle Agent FODIP."
      oidcPortal="agent"
    />
  );
}
