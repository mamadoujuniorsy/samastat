# Déployer SamaStat

Ce guide est destiné à une personne qui récupère le dépôt sur un serveur vierge.
La méthode recommandée pour la démonstration et la reprise par l'ANSD est Docker Compose.

## 1. Prérequis

- Git
- Docker Engine avec le plugin Docker Compose
- Au moins 8 Go de RAM disponibles (16 Go recommandés avec Kiriku)
- Environ 5 Go d'espace disque libre pour les images, les données et les modèles locaux
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
et Groq sert de repli automatique pour le LLM et les transcriptions non Wolof.

Pour la meilleure expérience de dictée Wolof pendant la démonstration, Groq Whisper
est le fournisseur recommandé :

```dotenv
SAMASTAT_WOLOF_ASR_PROVIDER=groq
```

Le serveur corrige quelques erreurs phonétiques fréquentes de Whisper (par exemple
`Deni, nyodeg, dagar.`) avant la recherche. La transcription affichée reste relue
par l'utilisateur avant l'envoi automatique.

Pour activer la transcription Wolof locale, renseigner si nécessaire le jeton Hugging
Face demandé par le dépôt Kiriku :

```dotenv
HUGGINGFACE_HUB_TOKEN=
SAMASTAT_ASR_MODEL=AIHubSN/kiriku-ASR
```

Le modèle est téléchargé au premier vocal Wolof et conservé dans le volume
`samastat-asr-models`. Un GPU n'est pas obligatoire, mais 8 Go de VRAM ou plus
réduisent fortement la latence.

Pour activer la connexion du personnel ANSD, renseigner aussi :

```dotenv
SAMASTAT_AUTH_SECRET=une-chaine-secrete-longue-et-aleatoire
```

Les canaux SMS, WhatsApp et Telegram, la traduction Wolof locale et la synthèse vocale
Wolof sont optionnels. Pour obtenir une voix Wolof naturelle, renseigner la clé Soynade :

```dotenv
SAMASTAT_WOLOF_TTS=0
SOYNADE_API_KEY=
SOYNADE_TTS_URL=https://api.soynade.ai/v1/text-to-speech
SOYNADE_TTS_FALLBACK_LOCAL=0
```

Avec `SOYNADE_TTS_FALLBACK_LOCAL=0`, une erreur Soynade désactive la lecture plutôt
que de servir la voix locale expérimentale. Le fallback local ne doit être activé
(`1`) qu'après validation de sa qualité sur la machine de démonstration.
Le service ASR local est inclus dans le profil `app` et reste disponible pour les
installations qui choisissent explicitement `SAMASTAT_WOLOF_ASR_PROVIDER=local`.

## 4 bis. Activer WhatsApp et Telegram

Les deux canaux utilisent des webhooks HTTPS publics. Le serveur ANSD doit donc être
accessible depuis Internet derrière un reverse proxy TLS. Le port interne de l'API reste
`3001`.

### WhatsApp Cloud API

Renseigner dans `.env` :

```dotenv
WHATSAPP_VERIFY_TOKEN=un-secret-de-verification
WHATSAPP_ACCESS_TOKEN=jeton-meta
WHATSAPP_PHONE_NUMBER_ID=id-du-numero
WHATSAPP_APP_SECRET=secret-de-l-application-meta
```

Dans le tableau de bord Meta, configurer l'URL :

```text
https://votre-domaine.example/whatsapp/webhook
```

Le jeton de vérification doit correspondre à `WHATSAPP_VERIFY_TOKEN`. Activer au
minimum l'événement `messages`. Le webhook accepte les questions texte et les vocaux.

### Telegram Bot API

Créer un bot avec `@BotFather`, puis renseigner :

```dotenv
TELEGRAM_BOT_TOKEN=jeton-du-bot
TELEGRAM_WEBHOOK_SECRET=secret-long-aleatoire
```

Après le démarrage de l'API, enregistrer le webhook depuis une machine autorisée :

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  --data-urlencode "url=  https://votre-domaine.example/telegram/webhook" \
  --data-urlencode "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
  --data-urlencode 'allowed_updates=["message"]'
```

Tester la configuration :

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
curl http://localhost:3001/telegram/status
```

Envoyer ensuite un message texte au bot. SamaStat répond avec la réponse de l'agent,
les valeurs trouvées et les sources ANSD. Les vocaux Telegram ne sont pas activés dans
ce premier lot afin de garder la démonstration courte et fiable ; WhatsApp conserve
son support vocal existant.

## 4. Construire et démarrer les services

```bash
docker compose --profile app up -d --build
```

Les services démarrés sont :

| Service | Adresse depuis le serveur | Rôle |
|---|---:|---|
| `web` | `http://localhost:3000` | Interface web |
| `api` | `http://localhost:3001` | API NestJS |
| `asr` | `http://localhost:8001` | Transcription Wolof locale |
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

Vérifier aussi le service ASR local :

```bash
curl http://localhost:8001/health
```

La réponse doit indiquer `"status": "ok"`. Le champ `"loaded": false` avant le
premier vocal est normal : Kiriku est chargé à la demande, puis conservé dans
le volume `samastat-asr-models`.

Vérifier le fournisseur vocal et de transcription configuré :

```bash
curl http://localhost:3001/wolof/status
```

Pour la démonstration recommandée, la réponse doit indiquer
`transcription.provider = "groq"` et `tts.provider = "soynade"`.

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
