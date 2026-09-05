# Étape 30 — Chaîne de release OCI institutionnelle

## Résultat

Le workflow `.github/workflows/release-oci.yml` publie les images API et web dans GHCR à partir
d'un tag SemVer `vX.Y.Z`. Le tag lisible sert à retrouver une version ; le déploiement REC, PPD et
PROD doit toujours consommer la référence immuable `image@sha256:...` inscrite dans le manifeste
de release signé.

Une release est refusée si :

- son tag n'est pas un SemVer strict `vX.Y.Z` ;
- le commit n'appartient pas à l'historique de `main` ;
- le contrôle CI « Dossier de preuves institutionnel » n'est pas réussi sur ce commit ;
- l'analyse CodeQL JavaScript/TypeScript n'est pas réussie sur ce commit.

## Artefacts et garanties

Pour chaque release, la chaîne produit :

| Élément | Garantie |
|---|---|
| Images `ghcr.io/skaba89/fodif_gestion-api` et `-web` | Tags version/SHA et digest OCI immuable |
| SBOM OCI | Inventaire logiciel attaché à chaque image par BuildKit |
| Provenance | Attestation GitHub SLSA liée au dépôt, workflow, commit et digest |
| Signature d'image | Signature keyless cosign/Fulcio, vérifiée dans le workflow |
| `release-manifest.json` | Correspondance exacte release, commit, digest API et digest web |
| `release-manifest.sigstore.json` | Signature et preuve de transparence du manifeste, conservées 365 jours |

Aucune clé de registre ni clé de signature longue durée n'est ajoutée au dépôt. GitHub fournit un
jeton de package limité au job et un jeton OIDC éphémère ; cosign obtient un certificat Fulcio de
courte durée et publie la preuve au journal de transparence Sigstore.

## Procédure de release

1. Vérifier que le commit voulu est fusionné dans `main` et que CI/CodeQL sont verts.
2. Créer puis pousser un tag signé et protégé par la gouvernance du dépôt :

   ```bash
   git switch main
   git pull --ff-only
   git tag -s v1.0.0 -m "FODIP Digital 2030 v1.0.0"
   git push origin v1.0.0
   ```

3. Télécharger l'artefact `release-manifest-v1.0.0` du workflow terminé.
4. Faire approuver les deux digests par le responsable technique avant promotion en PPD.
5. Promouvoir exactement les mêmes digests de PPD vers PROD ; ne jamais reconstruire entre les
   environnements.

## Vérification indépendante

Exemple pour l'image API, en remplaçant `<digest>` et `<version>` par le manifeste de release :

```bash
cosign verify \
  --certificate-identity "https://github.com/skaba89/Fodif_gestion/.github/workflows/release-oci.yml@refs/tags/<version>" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  "ghcr.io/skaba89/fodif_gestion-api@<digest>"
```

Le manifeste téléchargé se vérifie avec :

```bash
cosign verify-blob \
  --bundle release-manifest.sigstore.json \
  --certificate-identity "https://github.com/skaba89/Fodif_gestion/.github/workflows/release-oci.yml@refs/tags/<version>" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  release-manifest.json
```

## Portes restantes

Ce workflow rend le registre de qualification immédiatement utilisable, mais ne choisit pas à la
place de la DSI le registre institutionnel définitif. Si GHCR n'est pas retenu, conserver les mêmes
invariants lors du remplacement : validation préalable, digest, SBOM, provenance, signature,
manifeste et promotion sans reconstruction. Restent également à décider/provisionner : protection
des tags, visibilité et rétention des packages, environnements REC/PPD/PROD, gestionnaire de
secrets, réseau egress et cluster cible.
