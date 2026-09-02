import LoginForm from '../../_shared/LoginForm';

export default function DirectionLoginPage() {
  return (
    <LoginForm
      eyebrow="Cockpit national"
      title="Connexion Direction"
      lead="Accès réservé à la Direction FODIP et aux analystes habilités."
      redirectTo="/direction/tableau-de-bord"
      allowedRoles={['DIRECTION_FODIP', 'ANALYSTE', 'SUPER_ADMIN']}
      deniedMessage="Ce compte ne possède pas un rôle de pilotage autorisé."
      oidcPortal="direction"
    />
  );
}
