import LoginForm from '../../_shared/LoginForm';

export default function CommitteeLoginPage() {
  return (
    <LoginForm
      eyebrow="Décision collégiale"
      title="Connexion Comité"
      lead="Accès réservé aux membres autorisés. Le score éclaire la décision mais ne la remplace jamais."
      redirectTo="/comite/dossiers"
      allowedRoles={['COMITE_FINANCEMENT', 'SUPER_ADMIN']}
      deniedMessage="Ce compte ne possède pas le rôle Comité de financement."
      oidcPortal="comite"
    />
  );
}
