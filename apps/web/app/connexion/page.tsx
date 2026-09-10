import LoginForm from '../_shared/LoginForm';

export default function LoginPage() {
  return (
    <LoginForm
      eyebrow="Accès sécurisé"
      title="Connexion FODIP"
      lead="Un seul point d’accès pour les PME, agents, membres du comité, Direction, administration, auditeurs et partenaires. Après authentification, votre compte est dirigé automatiquement vers l’espace autorisé par ses rôles."
      oidcPortal="connexion"
      replaceHistory
    />
  );
}
