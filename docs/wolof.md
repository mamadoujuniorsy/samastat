# Wolof dans SamaStat

Approche graduée annoncée dans la proposition : lexique (niveau 1), extension et évaluation (niveau 2),
voix (niveau 3). État au 19 septembre 2026.

## Niveau 1 : lexique et détection

`backend/src/assistant/wolof.ts` : lexique de formulations courantes translittérées (avec et sans
diacritiques) associées à des mots-clés français, détection de langue heuristique, indices injectés dans la
question pour la recherche. Indépendant de tout modèle. À faire relire par un locuteur avant extension ;
les paires wolof/français de `galsenai/centralized_wolof_french_translation_data` (98 345 paires) et
`masakhane/mafand` (config `fr-wol`) sur Hugging Face sont les corpus de référence pour l'enrichir.

## Niveau 2 : traduction automatique locale

Modèle : `Xenova/nllb-200-distilled-600M` (port ONNX de NLLB-200 de Meta, 600 M de paramètres, codes
`wol_Latn` / `fra_Latn`), exécuté dans le processus Node par transformers.js, quantifié 8 bits, environ
1 Go téléchargé au premier usage, 3 à 8 s par phrase sur CPU. Activation : `SAMASTAT_WOLOF_TRANSLATION=1`.

Usage dans le traitement (`assistant.service.ts`) :

1. Question détectée en wolof → traduction vers le français, affichée comme étape (« Traduction : … ») et
   transmise au modèle comme indice **explicitement marqué faillible**. Le modèle garde la question
   d'origine et le lexique.
2. Le modèle répond en français. Le serveur produit ensuite la version wolof en traduisant le texte
   français **après avoir remplacé chaque valeur, période et source par un jeton** (X1, X2…) ; les jetons
   sont réinsérés après traduction. Si un jeton manque ou est dupliqué, la version wolof est abandonnée
   (`wolof/sentinels.ts`, testé). Le principe de non-invention tient donc aussi en wolof : aucun chiffre ne
   passe par le traducteur.
3. La réponse expose `answer` (français) et `answerWolof` (wolof ou null). Les clients affichent le wolof en
   premier quand la question était en wolof, le français dessous, avec la mention de traduction automatique.

Sans activation, le comportement précédent s'applique : le modèle de langage répond lui-même en wolof.

Mesures faites sur ce poste : « Ñaata nit ñoo dëkk Dakar ? » → « Combien de personnes vivent à Dakar ? »
(correct) ; « Naata la njëg yi yokku ci atum 2024 ? » → « Quelle est la croissance des records en 2024 ? »
(approximatif : le lexique apporte « njëg → prix inflation », ce qui suffit à la recherche).

Alternative sous licence MIT à évaluer : `bilalfaye/nllb-200-distilled-600M-wo-fr-en` (même architecture,
à exporter en ONNX avec Optimum pour transformers.js).

## Niveau 3 : voix wolof

Synthèse : `jaguaman09/mms-tts-wol-onnx`, conversion ONNX d'un VITS MMS adapté au wolof sur le corpus
WaxalNLP (AIMS Sénégal), 16 kHz, 40 à 115 Mo, moins d'une seconde par phrase sur CPU. Activation :
`SAMASTAT_WOLOF_TTS=1`. Route `POST /wolof/tts` → WAV. Qualité **expérimentale** : la page du modèle le
présente comme un point de contrôle de substitution, faute de modèle MMS natif pour le wolof. L'interface
l'indique (« voix wolof expérimentale »).

Reconnaissance vocale web : le navigateur enregistre un court clip puis le backend le transmet à Groq
Whisper (`whisper-large-v3-turbo`) pour transcription. L'audio quitte donc le navigateur et est envoyé à
un fournisseur tiers ; l'interface l'indique avant l'enregistrement. Le français est demandé avec le code
`fr`. Pour le wolof, la détection est laissée au modèle et un prompt donne le contexte sénégalais, mais la
qualité n'a pas été évaluée sur des locuteurs/accent locaux : l'interface doit présenter ce chemin comme
expérimental et demander de relire la transcription. Ne pas promettre une dictée wolof fiable.

Groq indique que les données de ses points de terminaison audio peuvent être conservées jusqu'à 30 jours
pour la fiabilité et la surveillance des abus, sauf configuration Zero Data Retention. Vérifier les
réglages du projet Groq et informer l'ANSD avant une mise en service. Pistes d'ASR local à évaluer :
`M9and2M/whisper-small-wolof` (MIT, WER annoncé 0,17) et `facebook/mms-1b-all` avec l'adaptateur `wol`.

## Licences

NLLB-200 et le modèle vocal sont sous **CC BY-NC 4.0** (usage non commercial). Compatible avec un service
public gratuit ; à signaler à l'ANSD dans la cession, avec l'alternative MIT ci-dessus. Les modèles ne sont
pas embarqués dans le dépôt : ils sont téléchargés dans `backend/.models` (volume `samastat-models` en
Docker).

## Ce qui n'existe pas

Aucun modèle nommé « Kirikou » n'a été trouvé sur Hugging Face. Le LLM wolof `soynade-research/Oolel-Small`
(1,8 G, quantifié 1,1 Go) est exécutable sur CPU via llama.cpp mais n'apporte rien au principe de
non-invention : SamaStat n'a pas besoin d'un modèle qui « sait » du wolof, seulement d'un traducteur fiable
autour d'un texte dont les chiffres sont protégés.
