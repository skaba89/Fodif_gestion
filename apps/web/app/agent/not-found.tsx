import EmptyState from '../_shared/EmptyState';

export default function NotFound() {
  return (
    <EmptyState
      title="Page introuvable"
      message="Cette page n'existe pas ou a été déplacée."
      actionHref="/agent/dossiers"
      actionLabel="Retour à l'accueil"
    />
  );
}
