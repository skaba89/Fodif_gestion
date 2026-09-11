import type { Metadata } from 'next';
import PublicInformationPage from '../_shared/PublicInformationPage';

export const metadata: Metadata = {
  title: 'Mentions légales — FODIP Digital 2030',
};

export default function LegalNoticePage() {
  return (
    <PublicInformationPage
      eyebrow="Information institutionnelle"
      title="Mentions légales"
      lead="FODIP Digital 2030 est la plateforme numérique de gestion du financement des PME portée par le Fonds de Développement Industriel et des PME de la République de Guinée."
      note="Cette page décrit les éléments déjà établis dans le produit. Les coordonnées réglementaires complètes de l’éditeur, du responsable de publication et de l’hébergeur devront être validées par le FODIP avant la mise en production publique."
      sections={[
        {
          title: 'Éditeur du service',
          paragraphs: [
            'Le service est présenté sous l’identité FODIP Digital 2030, pour le Fonds de Développement Industriel et des PME de la République de Guinée.',
            'La plateforme couvre la chaîne Dossier → Instruction → Décision → Financement → Suivi et réserve chaque espace aux utilisateurs habilités.',
          ],
        },
        {
          title: 'Sécurité et traçabilité',
          paragraphs: [
            'Les comptes sont authentifiés avant tout accès aux espaces métiers. Les actions sensibles sont contrôlées côté API et les opérations prévues pour l’audit sont journalisées.',
            'Aucun utilisateur ne doit communiquer son mot de passe, son code de double authentification ou un secret de connexion à un tiers.',
          ],
        },
        {
          title: 'Propriété et réutilisation',
          paragraphs: [
            'Les éléments institutionnels, données métier et contenus accessibles dans la plateforme sont soumis aux règles de diffusion et de réutilisation définies par le FODIP et les autorités compétentes.',
          ],
        },
      ]}
    />
  );
}
