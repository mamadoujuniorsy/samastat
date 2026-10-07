# SamaStat

Assistant statistique conversationnel du Sénégal. Une question en français, une valeur publiée
par l'ANSD, sa source, sa période, l'horodatage de récupération. Projet développé pour le Challenge
Open Data des 20 ans de l'ANSD.

## Principe non négociable

**Le modèle de langage ne produit jamais un chiffre.** Il comprend la question, choisit un
indicateur dans le catalogue via des outils, et formule une phrase où chaque valeur est un
placeholder `{{value:ID}}` que le serveur remplace par l'enregistrement de la base. Une garde
(`backend/src/assistant/answer-renderer.ts`) rejette toute réponse contenant un chiffre écrit par le
modèle ou un placeholder vers un enregistrement non récupéré ; le texte est alors reconstruit
uniquement à partir des enregistrements. Si rien ne correspond, le système le dit et propose des
reformulations que le catalogue peut satisfaire.

## État d'avancement

### Jalon 1 (chaîne de bout en bout)

- API NestJS utilisée par le site web et les canaux connectés : questions statistiques, catalogue, état de service, exports et routes du personnel
- Catalogue : 138 indicateurs réels relevés sur ansd.sn (RGPH-5 dont les 46 départements et 5 communes de la région de Dakar, EHCVM II, ENES, IHPC, comptes nationaux, EDS-Continue 2023 et Situation économique et sociale pour la santé ; voir `docs/sources-donnees.md`) et 286 études du catalogue ANADS (métadonnées) pour orienter vers les microdonnées
- Protocole de validation : `npm run eval` sur 26 questions à réponse attendue (`backend/eval/questions.json`), rapport avec taux de justesse, de non-réponse assumée et d'erreur ; `npm run eval:search` mesure le moteur de correspondance seul, sans modèle ni clé (au 19/09/2026, 28 questions dont 3 en wolof : attendu dans le top 3 pour 96 %, top 10 pour 100 %, rang réciproque moyen 0,81)
- Lien permanent par réponse (`/r/:id`), lisible et citable sans compte ; page Méthode (`/methode`) expliquant le principe de non-invention et la vérifiabilité
- Espace ANSD : compte administrateur initial facultatif provisionné depuis `SAMASTAT_BOOTSTRAP_ADMIN_EMAIL`, `SAMASTAT_BOOTSTRAP_ADMIN_NAME` et `SAMASTAT_BOOTSTRAP_ADMIN_PASSWORD` (créé une fois, jamais réinitialisé au redémarrage) ; gestion des comptes réservée aux admins sur `/personnel`, ou commandes CLI (`npm run staff:add -- <email> "<nom>" admin`, mot de passe dans `STAFF_PASSWORD`, haché scrypt) ; connexion sur `/connexion` (session signée de 12 h en cookie httpOnly), tableau de bord d'usage réservé aux agents connectés et réindexation protégée
- Interface web refondue : barre latérale, thème clair par défaut avec bascule, typographie éditoriale (Newsreader pour les titres et chiffres-vedettes, IBM Plex pour l'interface), accueil avec exemples par thème et repères chiffrés réels, question en titre et réponse structurée
- Application mobile Expo (React Native), canal principal : chat, dictée vocale, lecture des réponses à voix haute, historique local, partage d'une réponse avec ses sources (voir mobile/README.md)
- Interface web Next.js minimale : champ de question, fil de réponses, bloc source par valeur

### Finale : expérience utilisateur

- Réponses en flux (SSE, `POST /ask/stream`) : les étapes réelles du traitement s'affichent au fur et à mesure (recherche, valeurs récupérées, garde anti-invention), puis se replient
- Chiffre-vedette pour une valeur unique, barres pour plusieurs, carte des régions pour une comparaison régionale
- Bloc Champ · Source · Vérifié le · Identifiant sous chaque valeur, actions Écouter / Copier / Citer / Partager / CSV / JSON
- Suites spécifiques construites depuis la base (« Et Thiès ? », « Toutes les régions », « Évolution 2023 → 2025 »)
- Fiche partageable par indicateur (`/indicateur/:id` sur le web, feuille dans l'app) : séries par période et territoire, citation prête à copier
- Catalogue navigable (`/catalogue`) filtrable par thème, niveau et texte
- Bouton Arrêter pendant le traitement, relance après erreur, raccourci « / » vers le champ (web), retour haptique (mobile)
- Limitation de débit par adresse sur l'API ; système de design documenté dans `docs/DESIGN.md`
- Export SDMX-JSON 2.0 (profil simplifié, `format=sdmx`), le standard d'échange des instituts nationaux de statistique, en plus de CSV et JSON
- Canal SMS pour les zones sans données mobiles (webhook `POST /sms/inbound`, fournisseur Africa's Talking, inactif tant que `SMS_AT_*` est vide, réponse bornée à trois segments)

### Jalon 2 (index sémantique)

- Embeddings calculés localement (transformers.js, modèle multilingue e5-small, 384 dimensions) et stockés dans pgvector ; aucun service externe
- Recherche hybride : similarité vectorielle + plein texte français, filtres par territoire et période exposés au modèle
- Contexte de conversation : les derniers tours sont transmis à l'API pour comprendre « et à Thiès ? »

### Jalon 3 (données réelles)

- Cache Redis des réponses aux questions isolées (6 h), dégradation silencieuse si Redis est absent
- Indexation sémantique en tâche de fond : file BullMQ sur Redis (repli en processus sans Redis), auto-réparation au démarrage, `GET /admin/index` pour l'état, `POST /admin/reindex` protégé par `SAMASTAT_ADMIN_TOKEN`
- Connecteur Plateforme Open Data : bloqué par un challenge Cloudflare, voir `docs/sources-donnees.md`

### Jalon 4 (visualisation, export)

- Détection déterministe d'une évolution (même territoire, plusieurs périodes) ou d'une comparaison (même période, plusieurs territoires) parmi les enregistrements récupérés ; rendu en barres proportionnelles sur mobile et web, sans bibliothèque
- Carte choroplèthe SVG des 14 régions (web) pour les comparaisons régionales et sur le tableau de bord, contours geoBoundaries (CC BY 4.0)
- Partage texte (mobile) de la réponse, des valeurs, des sources et de l'attribution ; historique de session conservé dans le navigateur (web) et sur l'appareil (mobile)
- Export CSV ou JSON des enregistrements cités (`GET /export?ids=a,b&format=csv`, liens sous chaque réponse web), avec l'attribution en en-tête

### Jalon 5 (extensions)

- Wolof, approche graduée (voir `docs/wolof.md`) : lexique de formulations courantes → mots-clés français et détection de langue (niveau 1) ; traduction automatique locale wolof ↔ français par NLLB-200 en ONNX, la question traduite étant affichée comme étape et la réponse rendue en wolof avec les valeurs, périodes et sources protégées par jetons (niveau 2, `SAMASTAT_WOLOF_TRANSLATION=1`) ; voix wolof locale expérimentale, `GET/POST /wolof/tts` (niveau 3, `SAMASTAT_WOLOF_TTS=1`). Modèles sous CC BY-NC 4.0, téléchargés à l'activation.
- Tableau de bord d'usage anonyme destiné à l'ANSD (`/usage`) : questions par jour, répartition linguistique, thématique et géographique (carte), questions restées sans donnée, indicateurs mobilisés, déclenchements de la garde
- Canal WhatsApp via l'API Cloud de Meta : webhook `GET/POST /whatsapp/webhook` (vérification du jeton, signature HMAC, contexte de conversation par numéro en mémoire), inactif tant que les variables `WHATSAPP_*` sont vides. Non testé en conditions réelles faute de compte Meta Business.

## Démarrage

Prérequis : Node 22+, Docker, et au moins une clé de modèle : `ANTHROPIC_API_KEY` (principal) ou `GROQ_API_KEY`
(repli, gratuit sur console.groq.com). Avec les deux, Anthropic répond et Groq prend le relais automatiquement
en cas de clé invalide, de quota atteint ou de panne.

```bash
npm install
cp .env.example .env            # puis renseigner ANTHROPIC_API_KEY et/ou GROQ_API_KEY
npm run db:up                   # PostgreSQL (pgvector) sur 5440, Redis sur 6390
npm run db:migrate
npm run db:seed
npm run db:seed:surveys         # catalogue ANADS (286 études, métadonnées)
npm run db:index                # embeddings locaux (télécharge ~460 Mo de modèle au premier lancement)
npm run dev:backend             # http://localhost:3001
npm run dev:frontend            # http://localhost:3000 (web)
npm run dev:mobile              # Expo ; dictée vocale = build de développement (npx expo run:android)
```

Les ports 5440 et 6390 ont été choisis pour ne pas entrer en conflit avec des instances locales ;
ils se changent dans `docker-compose.yml` et `.env`.

### Premier compte administrateur

Renseignez les trois variables `SAMASTAT_BOOTSTRAP_ADMIN_EMAIL`, `SAMASTAT_BOOTSTRAP_ADMIN_NAME` et
`SAMASTAT_BOOTSTRAP_ADMIN_PASSWORD` dans `.env` avant le démarrage de l'API. Au démarrage, l'API crée ce
compte avec le rôle `admin` s'il n'existe pas encore. Le mot de passe (10 caractères minimum) est stocké
uniquement sous forme hachée ; les redémarrages ne le remplacent pas. Après connexion, l'administrateur peut
créer des comptes analyste ou admin dans **Gestion du personnel**. Ne partagez pas le `.env` et retirez les
identifiants de bootstrap de l'environnement après avoir créé le premier compte si vous n'en avez plus besoin.

Vérification rapide :

```bash
curl -X POST localhost:3001/ask -H 'content-type: application/json' \
  -d '{"question":"Quelle est la population de la région de Dakar ?"}'
```

## Déploiement Docker (API + web + base + Redis)

```bash
cp .env.example .env                       # renseigner ANTHROPIC_API_KEY et/ou GROQ_API_KEY
docker compose --profile app up -d --build
docker compose exec api npx tsx scripts/db.ts migrate
docker compose exec api npx tsx scripts/db.ts seed
docker compose exec api npx tsx scripts/db.ts index   # le modèle est conservé dans le volume samastat-models
```

L'API écoute sur le port 3001 et le site web sur le port 3000. L'application mobile se construit à part
(voir `mobile/README.md`) et pointe vers l'API par `EXPO_PUBLIC_API_URL`.

## Structure

```text
backend/
  scripts/db.ts                    migrations SQL + seed (sans dépendance Nest)
  src/database/                    pool pg, migrations, seed/indicators.json
  src/indicators/                  dépôt d'indicateurs (recherche, récupération par id)
  src/indicators/embedding.ts      embeddings locaux (transformers.js), texte indexé
  src/indexing/                    file BullMQ d'indexation, routes d'administration
  src/whatsapp/                    webhook et envoi WhatsApp (API Cloud Meta)
  src/assistant/
    tools.ts                       outils exposés au modèle + prompt système
    assistant.service.ts           boucle d'appel d'outils, contexte, cache
    answer-renderer.ts             placeholders + garde anti-invention
    chart.ts                       détection évolution / comparaison
    wolof.ts                       lexique et détection de langue
    usage-log.service.ts           journal anonymisé + agrégats d'usage
mobile/
  src/screens/ChatScreen.tsx     écran de chat (Expo / React Native)
  src/hooks/                     conversations, dictée vocale, synthèse vocale
  src/components/                barre, saisie, bulles, carte source, historique
frontend/
  src/app/api/                     relais vers l'API backend
  src/components/                  chat, formulaire, état vide, carte de réponse
docs/
  DESIGN.md                        système de design (couleurs, typographie, primitives de réponse)
  architecture.md                  couches, flux d'une question, principe de non-invention dans le code
  exploitation.md                  déploiement, mise à jour des catalogues, validation, supervision
  ui-ux-principes.md               checklist UI/UX (anti-patterns « vibe-codés » à éviter)
  sources-donnees.md               ce qui a été vérifié en ligne, ce qui est bloqué
```

## Format de réponse de `POST /ask`

```json
{
  "status": "answered | no_data | conversation | error",
  "question": "…",
  "answer": "texte rendu, valeurs injectées depuis la base",
  "suggestions": ["reformulations proposées si no_data"],
  "data": [{ "indicatorId": "…", "formattedValue": "…", "territory": "…", "period": "…", "source": "…", "url": "…" }],
  "chart": { "kind": "evolution | comparison", "title": "…", "unit": "…", "points": [{ "label": "…", "value": 0, "formattedValue": "…", "indicatorId": "…" }] },
  "meta": { "model": "…", "retrievedAt": "ISO 8601", "guard": "passed | fallback", "toolCalls": [], "latencyMs": 0, "language": "fr | wo | unknown", "cached": false, "attribution": "…" }
}
```

La requête accepte un contexte facultatif : `{ "question": "et à Thiès ?", "history": [{ "role": "user", "text": "…" }, { "role": "assistant", "text": "…" }] }`.

## Tests

```bash
npm test          # tests unitaires backend (garde anti-invention, formatage)
npm run lint
```

## Licence des données

Ce produit a été adapté à partir des informations de l'ANSD, sous licence conformément à l'Accord
de licence de données ouvertes de l'ANSD (Creative Commons Attribution 4.0).
