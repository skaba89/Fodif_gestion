import LoginForm from '../../_shared/LoginForm';

export default function AuditeurLoginPage() {
  return (
    <LoginForm
      eyebrow="Supervision indépendante"
      title="Connexion Auditeur"
      lead="Accès en lecture seule au portefeuille de financements et au journal d'audit de la plateforme."
      redirectTo="/auditeur/tableau-de-bord"
      allowedRoles={['AUDITEUR', 'SUPER_ADMIN']}
      deniedMessage="Ce compte ne possède pas le rôle Auditeur."
      oidcPortal="auditeur"
    />
  );
}
