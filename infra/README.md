# Infrastructure — FODIP Digital 2030

Cible d'infrastructure : environnements DEV / REC / PPD / PROD séparés, déploiements automatisés, secrets externalisés, sauvegardes testées et observabilité centralisée.

Composants envisagés :

- hébergement web/API conteneurisé ;
- PostgreSQL managé ;
- stockage objet S3 compatible (MinIO pour le déploiement Docker actuel) ;
- gestionnaire de secrets externe à définir pour les environnements hébergés ;
- Redis ;
- RabbitMQ ou NATS pour les traitements asynchrones futurs ;
- WAF / API Gateway ;
- Snowflake pour la Data Platform ;
- CI/CD GitHub Actions.

Aucun état Terraform, secret ou fichier `.env` réel ne doit être versionné.
