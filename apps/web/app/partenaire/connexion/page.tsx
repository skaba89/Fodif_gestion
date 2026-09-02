import LoginForm from '../../_shared/LoginForm';

export default function PartenaireLoginPage() {
  return (
    <LoginForm
      eyebrow="Établissement financier partenaire"
      title="Connexion Partenaire"
      lead="Consultez les financements dans votre périmètre et déclarez vos décaissements et remboursements pour le compte du FODIP."
      redirectTo="/partenaire/financements"
      allowedRoles={['PARTENAIRE_BANCAIRE']}
      deniedMessage="Ce compte ne possède pas le rôle Partenaire bancaire."
    />
  );
}
