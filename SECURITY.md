# Politique de sécurité

## Versions concernées

RememberMe est déployé en continu depuis la branche `main`. Seule la dernière version de `main` (celle qui est en production) reçoit des correctifs.

## Signaler une vulnérabilité

Merci de **ne pas ouvrir d'issue publique** pour un problème de sécurité.

Utilisez le signalement privé de GitHub : onglet **Security** du dépôt, puis **Report a vulnerability** (https://github.com/nagoloumdaniel/Backend_RememberMe/security/advisories/new).

Merci d'indiquer : la zone concernée, les étapes de reproduction, l'impact estimé. Ne joignez jamais de vrais mots de passe, jetons ou chaînes de connexion.

Il s'agit d'un projet personnel maintenu par une seule personne : accusé de réception visé sous quelques jours, sans délai de correction garanti.

## Secrets

Aucun secret ne doit être commité. Les variables d'environnement (`MONGODB_URI`, `JWT_SECRET`, `VITE_API_URL`) se configurent localement dans un fichier `.env` ignoré par Git, et sur Vercel pour la production. Si vous constatez qu'un secret est exposé dans le dépôt, signalez-le par le canal privé ci-dessus.
