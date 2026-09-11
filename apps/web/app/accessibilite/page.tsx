import type { Metadata } from 'next';
import PublicInformationPage from '../_shared/PublicInformationPage';

export const metadata: Metadata = {
  title: 'Accessibilité — FODIP Digital 2030',
};

export default function AccessibilityPage() {
  return (
    <PublicInformationPage
      eyebrow="Service public numérique"
      title="Accessibilité"
      lead="FODIP Digital 2030 vise une expérience utilisable sur mobile comme sur ordinateur, au clavier, avec technologies d’assistance et dans les situations de connectivité dégradée."
      note="Objectif produit : WCAG 2.2 niveau AA. Une déclaration formelle de conformité ne doit être publiée qu’après un audit d’accessibilité complet de la version mise en production."
      sections={[
        {
          title: 'Principes appliqués',
          bullets: [
            'Structure sémantique en français et lien d’évitement vers le contenu principal.',
            'Navigation clavier, focus visible et cibles tactiles d’au moins 44 px pour les actions principales.',
            'Contrastes sémantiques en thèmes clair et sombre et information qui ne dépend pas uniquement de la couleur.',
            'Tableaux adaptatifs, libellés de formulaires explicites, dialogues avec gestion du focus et messages annoncés aux technologies d’assistance.',
            'Respect de prefers-reduced-motion pour limiter les animations lorsque l’utilisateur le demande.',
          ],
        },
        {
          title: 'Contrôles continus',
          paragraphs: [
            'Le dépôt applicatif contient des tests automatisés Axe exécutés sur les écrans publics et authentifiés ainsi que des parcours Playwright couvrant des formats desktop et mobile.',
            'Ces tests sont des garde-fous et ne remplacent pas les tests manuels avec clavier, lecteur d’écran et appareils réels.',
          ],
        },
        {
          title: 'Signaler une difficulté',
          paragraphs: [
            'Toute difficulté d’accès doit être transmise par les canaux institutionnels de support communiqués par le FODIP, en précisant la page concernée, l’action tentée et le type d’appareil ou de technologie d’assistance utilisé.',
          ],
        },
      ]}
    />
  );
}
