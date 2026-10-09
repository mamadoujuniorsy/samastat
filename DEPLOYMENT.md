# Déployer SamaStat sur un VPS

Ce guide est destiné à une personne qui récupère le dépôt sur un serveur vierge.
La méthode recommandée pour la démonstration et la reprise par l'ANSD est un VPS
Linux avec Docker Compose. Les fonctions principales (site web, API, catalogue et
recherche) ne nécessitent ni nom de domaine ni WhatsApp/Telegram.

## 1. Prérequis

- Git
- Docker Engine avec le plugin Docker Compose
- Au moins 8 Go de RAM disponibles (16 Go recommandés avec Kiriku)
- Environ 5 Go d'espace disque libre pour les images, les données et les modèles locaux
- Une clé `ANTHROPIC_API_KEY` ou `GROQ_API_KEY` pour poser de vraies questions

Les liens officiels pour créer ou récupérer les identifiants sont regroupés dans la
[section 4.1](#41-où-obtenir-les-clés-et-identifiants). Ne jamais copier une clé
dans GitHub, une capture d'écran ou un ticket public.

Le premier indexage télécharge un modèle local d'embeddings. Il peut prendre quelques minutes.
Le volume Docker `samastat-models` conserve ce modèle pour les redémarrages suivants.

## 2. Préparer le VPS

Sur un VPS Ubuntu/Debian fraîchement installé, installer Docker et Git avec les
paquets officiels de la distribution, puis vérifier. Exemple Ubuntu :

```bash
sudo apt update
sudo apt install -y git docker.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```

Reconnecter la session SSH après l'ajout au groupe `docker`, puis vérifier :

```bash
docker --version
docker compose version
git --version
```

Autoriser uniquement SSH et, si le site doit être consulté directement, les ports
`3000` et `3001` dans le pare-feu du VPS. En production, il est préférable de
n'exposer publiquement que le port HTTPS du reverse proxy et de garder `3001`
interne.

## 3. Récupérer le projet

```bash
git clone <URL_DU_DEPOT>
cd samastat
```

Ne jamais ajouter un fichier `.env` ou une clé de fournisseur au dépôt.

## 4. Configurer l'environnement

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

### 4.1 Où obtenir les clés et identifiants

| Variable | Où l'obtenir | Obligatoire ? |
|---|---|---|
| `ANTHROPIC_API_KEY` | [Console Anthropic - API keys](https://console.anthropic.com/settings/keys) | Une clé LLM, avec Groq |
| `GROQ_API_KEY` | [Console Groq - API keys](https://console.groq.com/keys) | Une clé LLM, avec Anthropic |
| `HUGGINGFACE_HUB_TOKEN` | [Hugging Face - User access tokens](https://huggingface.co/settings/tokens) | Seulement pour Kiriku local |
| `SOYNADE_API_KEY` | [Site officiel Soynade](https://soynade.ai/) puis l'espace développeur du compte | Seulement pour le TTS Soynade |
| `WHATSAPP_*` | [Meta for Developers](https://developers.facebook.com/) et [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api) | Seulement pour WhatsApp |
| `TELEGRAM_BOT_TOKEN` | Bot Telegram officiel [@BotFather](https://t.me/BotFather) avec `/newbot` | Seulement pour Telegram |

Les pages de console peuvent demander la création d'un compte, l'activation de la
facturation ou des autorisations supplémentaires. Ces conditions dépendent du
fournisseur et ne sont pas gérées par SamaStat.

Les valeurs suivantes ne sont pas récupérées sur un site externe :

- `SAMASTAT_AUTH_SECRET` : générer une chaîne aléatoire longue pour les sessions ANSD ;
- `TELEGRAM_WEBHOOK_SECRET` : générer une chaîne aléatoire longue pour sécuriser le webhook ;
- `WHATSAPP_VERIFY_TOKEN` : choisir une chaîne aléatoire, puis saisir exactement la
  même valeur dans Meta et dans `.env`.

Sous Linux, générer un secret sans l'afficher dans le dépôt avec :

```bash
openssl rand -hex 32
```

Sous PowerShell :

```powershell
[Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Les tokens et clés sont à conserver dans un gestionnaire de secrets ou dans le fichier
`.env` du serveur avec des permissions restrictives :

```bash
chmod 600 .env
```

## 5. Canaux WhatsApp et Telegram (facultatifs, non bloquants)

Le site web et l'API fonctionnent parfaitement sans ces canaux. Ils ne doivent pas
bloquer l'installation, la démonstration ou la validation du projet.

WhatsApp et Telegram utilisent des webhooks appelés par Internet. Leur activation
demande donc une URL HTTPS publique vers l'API, généralement fournie par un nom de
domaine et un reverse proxy TLS. Une adresse `localhost`, `127.0.0.1` ou `0.0.0.0`
ne convient pas pour ces webhooks. Le port interne de l'API reste `3001`.

Si l'ANSD ne souhaite pas activer ces canaux immédiatement, laisser toutes les
variables ci-dessous vides : l'application restera opérationnelle.

### WhatsApp Cloud API

La création de l'application et la configuration du numéro de test se font dans
[Meta for Developers](https://developers.facebook.com/). Consulter la
[documentation officielle du webhook WhatsApp](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)
pour les étapes et les permissions qui peuvent évoluer.

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

Créer un bot avec [@BotFather](https://t.me/BotFather), puis renseigner :

```dotenv
TELEGRAM_BOT_TOKEN=jeton-du-bot
TELEGRAM_WEBHOOK_SECRET=secret-long-aleatoire
```

Après le démarrage de l'API, enregistrer le webhook depuis une machine autorisée :

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  --data-urlencode "url=https://votre-domaine.example/telegram/webhook" \
  --data-urlencode "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
  --data-urlencode 'allowed_updates=["message"]'
```

La documentation officielle de la méthode est disponible dans
[Telegram Bot API - setWebhook](https://core.telegram.org/bots/api#setwebhook).
Le bot Telegram de démonstration accepte les messages texte ; les messages vocaux
Telegram ne sont pas activés dans cette version.

Tester la configuration :

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
curl http://localhost:3001/telegram/status
```

Envoyer ensuite un message texte au bot. SamaStat répond avec la réponse de l'agent,
les valeurs trouvées et les sources ANSD. WhatsApp conserve son support vocal existant.

## 6. Construire et démarrer les services

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

## 7. Initialiser la base et le catalogue

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

## 8. Vérifier le déploiement

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

Depuis un autre ordinateur, utiliser l'adresse IP du VPS :

```text
http://ADRESSE_IP_DU_VPS:3000
```

Depuis une réponse contenant des indicateurs, les liens d'export permettent de
télécharger les enregistrements cités dans plusieurs formats :

- **Excel (`.xlsx`)** : classeur avec une feuille `Lisez-moi` (date et attribution)
  et une feuille `Indicateurs` filtrable ;
- **CSV** : séparateur `;`, encodage UTF-8 avec BOM pour une ouverture correcte
  dans Excel ;
- **JSON** : format structuré pour un traitement par script ;
- **SDMX-JSON** : format d'échange statistique simplifié (`format=sdmx`).

Les exports sont construits à partir des valeurs présentes dans la base, et non
à partir du texte généré par le modèle.

Cette URL suffit pour tester le site web. Aucun domaine n'est requis pour ce
parcours local ou réseau.

## 9. Créer le premier compte ANSD (optionnel)

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

## 10. Exploitation courante

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

Activer le redémarrage automatique après un reboot du VPS :

```bash
docker compose --profile app up -d
```

Pour une installation durable, ajouter un service systemd ou une tâche de
démarrage qui exécute cette commande après le démarrage de Docker.

## 11. Mise à jour du code

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

## 12. Exposer le site proprement (recommandé)

Pour une utilisation publique, placer Nginx, Caddy ou Traefik devant le conteneur
web. Le reverse proxy fournit HTTPS et transmet le trafic vers :

```text
web  -> http://127.0.0.1:3000
api  -> http://127.0.0.1:3001
```

Le site peut être publié seul. Les routes de webhook facultatives à transmettre
vers l'API sont :

```text
/whatsapp/webhook
/telegram/webhook
```

Il n'est pas nécessaire de publier ces routes si WhatsApp et Telegram ne sont pas
activés.

## 13. Dépannage rapide

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

## 14. Limites connues

- Le catalogue fourni est un jeu de données vérifié et versionné ; il ne constitue pas
  automatiquement l'intégralité des données publiées par l'ANSD.
- Les canaux SMS, WhatsApp et Telegram sont optionnels et nécessitent leurs comptes
  fournisseurs, leurs secrets et, pour les webhooks, une URL HTTPS publique.
- La traduction et la synthèse vocale Wolof sont optionnelles et nécessitent davantage
  de mémoire lorsqu'elles sont activées.
- La commande `index` est nécessaire avant d'obtenir la recherche sémantique complète.
