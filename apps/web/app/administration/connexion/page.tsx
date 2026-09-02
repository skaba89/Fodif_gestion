import LoginForm from '../../_shared/LoginForm';

export default function AdministrationLoginPage() {
  return (
    <LoginForm
      eyebrow="Accès restreint"
      title="Administration"
      lead="Gestion auditée des utilisateurs, rôles et périmètres PME."
      redirectTo="/administration/utilisateurs"
      allowedRoles={['SUPER_ADMIN']}
      deniedMessage="Compte super-administrateur requis."
      variant="narrow"
      replaceHistory
    />
  );
}
