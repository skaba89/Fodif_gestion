import LoginForm from '../../_shared/LoginForm';

export default function LoginPage() {
  return (
    <LoginForm
      eyebrow="Accès sécurisé"
      title="Connexion PME"
      lead="Connectez-vous pour accéder uniquement aux données de votre entreprise et à vos dossiers."
      redirectTo="/entrepreneur"
    />
  );
}
