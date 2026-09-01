# Infrastructure — FODIP Digital 2030

Cible d'infrastructure : environnements DEV / REC / PPD / PROD séparés, déploiements automatisés, secrets externalisés, sauvegardes testées et observabilité centralisée.

Composants envisagés :

- hébergement web/API conteneurisé ;
- PostgreSQL managé ;
- Azure Blob Storage ;
- Azure Key Vault ;
- Redis ;
- Azure Service Bus ;
- WAF / API Gateway ;
- Snowflake pour la Data Platform ;
- CI/CD GitHub Actions ou Azure DevOps selon la cible retenue.

Aucun état Terraform, secret ou fichier `.env` réel ne doit être versionné.
