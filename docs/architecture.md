# Architecture de SamaStat

Document destiné à une équipe technique qui reprend le code (cession prévue au règlement du Challenge).

## Vue d'ensemble

```text
CANAUX            app mobile Expo · site web Next.js · WhatsApp (API Cloud Meta) · API REST privée au produit
                                   │
COMPRÉHENSION     backend/src/assistant : détection de langue (wolof.ts), contexte de conversation,
                  modèle de langage en appel d'outils (assistant.service.ts, tools.ts)
                                   │
CORRESPONDANCE    backend/src/indicators : recherche hybride pgvector + plein texte français,
                  filtres territoire / période (indicators.repository.ts), catalogue ANADS (surveys.repository.ts)
                                   │
ACCÈS AUX DONNÉES PostgreSQL (indicators, surveys, question_log) · Redis (cache des réponses, file BullMQ)
                  · modèle d'embeddings local (embedding.ts, transformers.js)
                                   │
RESTITUTION       placeholders → valeurs (answer-renderer.ts), garde anti-invention, graphiques (chart.ts),
                  export CSV/Excel/JSON/SDMX (export.controller.ts), tableau de bord d'usage (usage-log.service.ts)
```

## Le principe de non-invention, dans le code

1. `tools.ts` : le modèle dispose de quatre outils. `search_indicators` renvoie des résumés **sans valeur**.
   `get_indicator_values` est la seule voie d'accès à une valeur. `search_surveys` renvoie des métadonnées
   d'enquêtes. `report_no_data` déclare l'absence de donnée avec des reformulations.
2. Le prompt système interdit tout chiffre écrit par le modèle : il écrit `{{value:ID}}`, `{{period:ID}}`,
   `{{survey:IDNO}}`, etc.
3. `answer-renderer.ts` remplace les placeholders par les champs de la base. Si le texte contient un chiffre hors
   placeholder, ou un placeholder vers un enregistrement non récupéré dans ce tour, la formulation libre est
   rejetée et remplacée par un texte construit uniquement à partir des enregistrements (`guard = fallback`).
4. `chart.ts` détecte une évolution ou une comparaison **sans calculer** : chaque point est un enregistrement.
5. Chaque réponse expose `data[]` (identifiant, valeur, unité, territoire, période, source, URL, thème),
   `surveys[]`, `meta.retrievedAt`, `meta.toolCalls` (trace auditable) et la mention d'attribution.

## Flux d'une question

```text
client → POST /ask {question, history}
  ├─ cache Redis (questions isolées, 6 h) → réponse identique, meta.cached = true
  ├─ détection de langue + indices lexicaux wolof
  ├─ boucle d'appel d'outils (6 itérations max)
  │    search_indicators → SQL hybride (0,7 × cosinus pgvector + 0,3 × ts_rank) filtré
  │    get_indicator_values → lignes de `indicators`, mémorisées dans l'état du tour
  │    search_surveys → lignes de `surveys`
  │    report_no_data → suggestions
  ├─ rendu + garde → status answered | no_data | conversation | error
  ├─ chart (évolution / comparaison)
  └─ journal anonyme question_log (question, statut, indicateurs, langue, latence)
```

## Données

| Table | Contenu | Alimentation |
|---|---|---|
| `indicators` | 70 indicateurs vérifiés, embedding 384 d, colonne `search_document` générée, `domain` | `npm run db:seed` depuis `seed/indicators.json` |
| `surveys` | 286 études ANADS (titre, années, résumé, mots-clés, URL, embedding) | `npm run db:seed:surveys` depuis `seed/anads-catalog.json` |
| `question_log` | journal anonyme | à chaque réponse |
| `schema_migrations` | migrations SQL appliquées | `npm run db:migrate` |

Les embeddings sont calculés par `Xenova/multilingual-e5-small` (transformers.js, ONNX) en local, au
premier `npm run db:index` ou automatiquement au démarrage de l'API pour les lignes non indexées
(`indexing.service.ts`, file BullMQ sur Redis avec repli en processus).

## Modèle de langage

Couche neutre `backend/src/llm/` : le service d'assistant ne manipule que des messages et des appels
d'outils génériques (`types.ts`), jamais un SDK.

- Principal : `anthropic.provider.ts`, modèle `SAMASTAT_MODEL` (défaut `claude-opus-5`), schémas d'outils
  stricts, prompt système mis en cache côté fournisseur.
- Repli : `openai-compatible.provider.ts`, toute API « chat completions » avec appel d'outils. Groq par défaut
  (`GROQ_API_KEY`, modèle `SAMASTAT_FALLBACK_MODEL`, défaut `llama-3.3-70b-versatile`) ; Gemini, Mistral,
  OpenRouter ou Ollama se branchent avec `SAMASTAT_FALLBACK_BASE_URL` et `SAMASTAT_FALLBACK_PROVIDER`.
- Arbitrage : `llm.service.ts`. Le principal est tenté en premier ; sur clé refusée, quota, erreur serveur,
  réseau injoignable ou refus du modèle, la question est rejouée sur le repli et le principal est mis en pause
  deux minutes. La bascule est visible dans les étapes (`kind: fallback`) et dans `meta.provider` /
  `meta.fallbackFrom` ; `meta.model` est toujours le modèle qui a réellement répondu.

Le contrat des outils est dans `tools.ts` et la garde anti-invention ne dépend pas du modèle : un repli plus
faible peut au pire déclencher plus souvent le texte reconstruit depuis la base, jamais un chiffre inventé.

## Clients

- `mobile/` : Expo (React Native). Dictée via les moteurs vocaux natifs (build de développement requis),
  lecture par `expo-speech`, historique local, partage, barres proportionnelles.
- `frontend/` : Next.js. Relais serveur vers l'API (`src/app/api/*`), page de chat, page `/usage`
  (tableau de bord ANSD), carte choroplèthe SVG des 14 régions (`src/lib/senegal-regions.ts`, contours
  geoBoundaries CC BY 4.0 simplifiés).
- WhatsApp : `backend/src/whatsapp`, webhook vérifié par jeton et signature HMAC ; contexte par numéro en
  mémoire, borné, jamais journalisé.

## Sécurité et données personnelles

- Aucune donnée personnelle stockée : le journal contient la question, le statut, les identifiants cités.
- Routes d'administration protégées par `SAMASTAT_ADMIN_TOKEN` ; fermées sans jeton.
- Webhook WhatsApp : signature `X-Hub-Signature-256` vérifiée si `WHATSAPP_APP_SECRET` est défini.
- Le modèle ne reçoit que la question, l'historique texte et les résultats d'outils.
