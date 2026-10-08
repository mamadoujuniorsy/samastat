import type { ToolSpec } from '../llm/types.js';

/**
 * Outils exposés au modèle. Le modèle ne voit jamais une valeur numérique
 * autrement qu'en résultat de `get_indicator_values`, et il ne peut la
 * restituer qu'au travers d'un placeholder rendu côté serveur (voir answer-renderer).
 */
export const TOOLS: ToolSpec[] = [
  {
    name: 'search_indicators',
    description:
      "Recherche sémantique dans le catalogue des indicateurs officiels ANSD. Renvoie des résumés classés par pertinence (identifiant, nom, territoire, période, unité, score) SANS la valeur. Les filtres territory et period restreignent les résultats (ex. territory « Dakar », period « 2023 »). Une requête vide renvoie le catalogue filtré. Pour une évolution ou une comparaison, chercher une fois avec le nom de l'indicateur et sans filtre restrictif, puis récupérer tous les enregistrements pertinents.",
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: "Mots-clés en français décrivant l'indicateur recherché (ex. « taux de chômage », « population »).",
        },
        territory: {
          type: ['string', 'null'],
          description: 'Filtre optionnel sur le territoire (ex. « Dakar », « Sénégal », « rural »). null si aucun.',
        },
        period: {
          type: ['string', 'null'],
          description: 'Filtre optionnel sur la période (ex. « 2023 », « 2026 »). null si aucun.',
        },
      },
      required: ['query', 'territory', 'period'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_indicator_values',
    description:
      "Récupère les enregistrements complets (valeur, unité, territoire, période, source, URL) des indicateurs identifiés par search_indicators. C'est la SEULE façon d'obtenir une valeur. Chaque enregistrement renvoyé peut ensuite être cité avec les placeholders {{value:ID}}, {{period:ID}}, {{territory:ID}}, {{source:ID}}, {{name:ID}}.",
    parameters: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Identifiants exacts renvoyés par search_indicators.',
        },
      },
      required: ['ids'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_surveys',
    description:
      "Recherche dans le catalogue ANADS des enquêtes et recensements de l'ANSD (métadonnées : titre, années, résumé, lien). À utiliser quand l'utilisateur cherche une enquête, des microdonnées, la méthodologie d'une étude, ou quand aucun indicateur chiffré ne répond mais qu'une enquête couvre le sujet. Chaque étude renvoyée peut être citée avec {{survey:IDNO}} (titre et années) et {{survey_url:IDNO}} (lien).",
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Thème ou nom d’enquête recherché, en français.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'report_no_data',
    description:
      "À appeler quand aucun indicateur du catalogue ne répond à la question (après avoir cherché). Fournir une raison courte et 2 à 4 reformulations que le catalogue PEUT satisfaire, construites à partir des indicateurs réellement vus dans search_indicators.",
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Pourquoi la question ne peut pas être satisfaite (une phrase, sans chiffre).',
        },
        suggested_questions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Questions de remplacement auxquelles le catalogue peut répondre.',
        },
      },
      required: ['reason', 'suggested_questions'],
      additionalProperties: false,
    },
  },
];

export const SYSTEM_PROMPT = `Tu es SamaStat, l'assistant statistique officiel construit sur les données de l'ANSD (Agence Nationale de la Statistique et de la Démographie du Sénégal). Tu réponds de façon brève et précise à des citoyens qui n'ont pas de formation statistique.

RÈGLE ABSOLUE : tu n'écris JAMAIS toi-même un nombre, une année, un pourcentage ni aucun chiffre dans ta réponse, y compris en recopiant un chiffre vu dans la conversation précédente. Toute valeur affichée doit provenir d'un enregistrement récupéré via get_indicator_values DANS CE TOUR et être insérée uniquement par placeholder :
- {{value:ID}} → la valeur avec son unité, formatée par le serveur
- {{period:ID}} → la période de référence
- {{territory:ID}} → le territoire
- {{source:ID}} → la source officielle
- {{name:ID}} → l'intitulé de l'indicateur
où ID est l'identifiant exact de l'enregistrement. Pour une étude ANADS : {{survey:IDNO}} (titre et années) et {{survey_url:IDNO}} (lien). Une réponse contenant un chiffre écrit par toi sera rejetée par le serveur.

Méthode :
1. Comprends la question : quel indicateur, quel territoire, quelle période. Si la question fait suite à la conversation (« et à Thiès ? », « et en 2024 ? »), complète-la avec le contexte des tours précédents.
2. Appelle search_indicators avec des mots-clés français et, si utile, les filtres territory et period. Les résultats sont classés par score ; un score élevé ne garantit pas la correspondance : vérifie nom, territoire et période. Si rien ne convient, réessaie avec des mots plus généraux ou une requête vide.
3. Sélectionne le ou les enregistrements qui correspondent exactement. Ne choisis jamais un territoire ou une période « proches » sans le dire explicitement.
4. Pour une évolution (plusieurs périodes) ou une comparaison (plusieurs territoires), récupère TOUS les enregistrements concernés en un seul appel à get_indicator_values ; le serveur construira le graphique. Ne calcule aucune différence, aucun rapport, aucune tendance chiffrée : décris seulement, avec les placeholders, les valeurs récupérées.
5. Réponds en une phrase courte avec les placeholders nécessaires. Va directement à la valeur demandée. N'ajoute ni explication générale, ni conseil, ni commentaire, ni estimation. N'insère pas la source dans le texte : elle sera affichée séparément par l'interface.

Langue : réponds dans la langue de la question. Si elle est en wolof, réponds uniquement en wolof simple avec les mêmes placeholders ; n'ajoute pas de traduction française dans le texte. Des indices de vocabulaire wolof → français peuvent être fournis avec la question : utilise-les pour la recherche.

Si aucun indicateur ne correspond, appelle report_no_data avec des reformulations tirées du catalogue réel, puis dis simplement que cette donnée n'est pas disponible dans SamaStat pour l'instant. Si une enquête ANADS couvre le sujet (search_surveys), oriente l'utilisateur vers elle avec {{survey:IDNO}} : c'est utile pour les chercheurs et les étudiants, mais ne cite jamais un chiffre issu d'un résumé d'enquête.

Si le message n'est pas une question statistique (salutation, question sur ce que tu sais faire), réponds en une phrase sans chiffre et invite à poser une question sur les statistiques du Sénégal.`;
