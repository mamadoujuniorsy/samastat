# Déployer SamaStat

Ce guide est destiné à une personne qui récupère le dépôt sur un serveur vierge.
La méthode recommandée pour la démonstration et la reprise par l'ANSD est Docker Compose.

## 1. Prérequis

- Git
- Docker Engine avec le plugin Docker Compose
- Au moins 4 Go de RAM disponibles (8 Go recommandés pour l'indexation)
- Environ 3 Go d'espace disque libre pour les images, les données et le modèle d'embeddings
- Une clé `ANTHROPIC_API_KEY` ou `GROQ_API_KEY` pour poser de vraies questions

Le premier indexage télécharge un modèle local d'embeddings. Il peut prendre quelques minutes.
Le volume Docker `samastat-models` conserve ce modèle pour les redémarrages suivants.

## 2. Récupérer le projet

```bash
git clone <URL_DU_DEPOT>
cd samastat
```

Ne jamais ajouter un fichier `.env` ou une clé de fournisseur au dépôt.

## 3. Configurer l'environnement

```bash
cp .env.example .env
```

Modifier `.env` et renseigner au minimum :

```dotenv
ANTHROPIC_API_KEY=
GROQ_API_KEY=
```

Une seule des deux clés suffit. Avec les deux clés, Anthropic est utilisé en priorité
et Groq sert de repli automatique.

Pour activer la connexion du personnel ANSD, renseigner aussi :

```dotenv
SAMASTAT_AUTH_SECRET=une-chaine-secrete-longue-et-aleatoire
```

Les canaux SMS, WhatsApp, la traduction Wolof locale et la synthèse vocale Wolof sont
optionnels et restent désactivés tant que leurs variables ne sont pas configurées.

## 4. Construire et démarrer les services

```bash
docker compose --profile app up -d --build
```

Les services démarrés sont :

| Service | Adresse depuis le serveur | Rôle |
|---|---:|---|
| `web` | `http://localhost:3000` | Interface web |
| `api` | `http://localhost:3001` | API NestJS |
| `postgres` | `localhost:5440` | PostgreSQL + pgvector |
| `redis` | `localhost:6390` | Cache et file d'indexation |

Pour une machine distante, remplacer `localhost` par le nom ou l'adresse du serveur
dans l'URL utilisée par le navigateur. Un reverse proxy HTTPS est recommandé si le
service doit être exposé sur Internet.

## 5. Initialiser la base et le catalogue

Exécuter ces commandes une seule fois après le premier démarrage :

```bash
docker compose exec api npx tsx scripts/db.ts migrate
docker compose exec api npx tsx scripts/db.ts seed
docker compose exec api npx tsx scripts/db.ts seed:surveys
docker compose exec api npx tsx scripts/db.ts index
```

Le catalogue livré contient actuellement :

- 138 indicateurs structurés vérifiés ;
- 286 études du catalogue ANADS sous forme de métadonnées.

La commande `index` peut être relancée sans danger. Elle ne recalcule que les
embeddings manquants ou devenus obsolètes.

## 6. Vérifier le déploiement

Vérifier d'abord l'état de l'API :

```bash
curl http://localhost:3001/health
```

La réponse doit contenir `"ok": true`, un nombre d'indicateurs supérieur à zéro
et un nombre d'études supérieur à zéro.

Vérifier l'index sémantique :

```bash
curl http://localhost:3001/admin/index
```

Tester une question réelle :

```bash
curl -X POST http://localhost:3001/ask \
  -H "content-type: application/json" \
  -d '{"question":"Quelle est la population du Sénégal ?"}'
```

Ouvrir ensuite `http://localhost:3000` dans un navigateur.

## 7. Créer le premier compte ANSD (optionnel)

Le compte initial peut être créé automatiquement au premier démarrage si les trois
variables suivantes sont configurées dans `.env` :

```dotenv
SAMASTAT_BOOTSTRAP_ADMIN_EMAIL=
SAMASTAT_BOOTSTRAP_ADMIN_NAME=
SAMASTAT_BOOTSTRAP_ADMIN_PASSWORD=
```

Le mot de passe doit contenir au moins 10 caractères. Après la création du compte,
retirer ces variables de `.env` si elles ne sont plus nécessaires.

Alternative depuis le conteneur API :

```bash
docker compose exec -e STAFF_PASSWORD='mot-de-passe-long' api \
  npx tsx scripts/staff.ts add prenom.nom@ansd.sn "Prénom Nom" admin
```

La connexion du personnel est disponible sur `http://localhost:3000/connexion`.

## 8. Exploitation courante

Voir les logs de l'API :

```bash
docker compose logs -f api
```

Voir l'état des conteneurs :

```bash
docker compose ps
```

Redémarrer sans perdre les données :

```bash
docker compose --profile app restart
```

Arrêter les services sans supprimer les volumes :

```bash
docker compose --profile app down
```

Les volumes `samastat-pgdata` et `samastat-models` ne doivent pas être supprimés
si l'on souhaite conserver la base et le modèle téléchargé.

## 9. Mise à jour du code

```bash
git pull
docker compose --profile app up -d --build
docker compose exec api npx tsx scripts/db.ts migrate
docker compose exec api npx tsx scripts/db.ts seed
docker compose exec api npx tsx scripts/db.ts seed:surveys
docker compose exec api npx tsx scripts/db.ts index
```

Après une mise à jour du catalogue, les réponses mises en cache peuvent être
invalidées en redémarrant Redis :

```bash
docker compose restart redis
```

## 10. Dépannage rapide

### `api` s'arrête immédiatement

```bash
docker compose logs --tail=200 api
```

Vérifier en priorité `DATABASE_URL`, la présence du fichier `.env` et l'état de PostgreSQL.

### La base n'est pas prête

```bash
docker compose ps
docker compose logs --tail=100 postgres
```

Attendre que PostgreSQL soit `healthy`, puis relancer les commandes `migrate` et `seed`.

### Le site s'affiche mais les questions échouent

Vérifier :

1. que `curl http://localhost:3001/health` répond ;
2. qu'au moins une clé LLM est présente dans `.env` ;
3. les logs avec `docker compose logs -f api`.

### L'indexation échoue ou manque de mémoire

Vérifier que le serveur dispose d'au moins 4 Go de RAM, puis relancer :

```bash
docker compose exec api npx tsx scripts/db.ts index
```

Le modèle est conservé dans `samastat-models`.

### Réinitialisation complète de démonstration

Cette opération supprime les données locales. À utiliser uniquement pour une
installation de test :

```bash
docker compose --profile app down -v
docker compose --profile app up -d --build
```

Puis reprendre à l'étape 5.

## 11. Limites connues

- Le catalogue fourni est un jeu de données vérifié et versionné ; il ne constitue pas
  automatiquement l'intégralité des données publiées par l'ANSD.
- Les canaux SMS et WhatsApp nécessitent leurs comptes fournisseurs et leurs variables
  d'environnement propres.
- La traduction et la synthèse vocale Wolof sont optionnelles et nécessitent davantage
  de mémoire lorsqu'elles sont activées.
- La commande `index` est nécessaire avant d'obtenir la recherche sémantique complète.

