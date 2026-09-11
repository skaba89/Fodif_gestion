import type { Metadata } from 'next';
import PublicInformationPage from '../_shared/PublicInformationPage';

export const metadata: Metadata = {
  title: 'Confidentialité — FODIP Digital 2030',
};

export default function PrivacyPage() {
  return (
    <PublicInformationPage
      eyebrow="Protection des informations"
      title="Confidentialité"
      lead="La plateforme traite des informations nécessaires à l’instruction, à la décision, au financement et au suivi des PME. L’accès à ces informations dépend du rôle et du périmètre autorisé de chaque compte."
      note="Les durées de conservation, fondements juridiques, coordonnées de contact et modalités d’exercice des droits devront être alignés sur la politique de protection des données officiellement adoptée par le FODIP avant la mise en production publique."
      sections={[
        {
          title: 'Données concernées',
          bullets: [
            'Informations d’identification et de contact des comptes habilités.',
            'Informations relatives aux entreprises, demandes de financement et pièces justificatives nécessaires au traitement des dossiers.',
            'Décisions, opérations financières, statuts, commentaires métier et traces d’audit générées au cours du processus.',
          ],
        },
        {
          title: 'Accès et sécurité',
          paragraphs: [
            'Les contrôles d’accès sont appliqués côté API à partir des rôles et habilitations du compte. Les espaces Agent, Comité, Direction, Administration, Auditeur, Partenaire bancaire et PME n’exposent que les fonctionnalités prévues pour leur périmètre.',
            'Les réponses API contenant des données financières ou personnelles ne sont pas placées dans le cache hors-ligne partagé du service worker. Cette mesure évite de servir des données de session obsolètes ou appartenant à un autre utilisateur sur un appareil partagé.',
          ],
        },
        {
          title: 'Traçabilité',
          paragraphs: [
            'Les changements de statut, décisions et actions sensibles prévues par les workflows métier sont conçus pour rester traçables et horodatés. Les utilisateurs doivent s’assurer qu’ils opèrent depuis leur propre compte et fermer leur session lorsqu’ils utilisent un appareil partagé.',
          ],
        },
      ]}
    />
  );
}
