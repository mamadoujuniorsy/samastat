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

Avant synthèse, le texte est normalisé (minuscules, ponctuation simplifiée et `%` développé en
« pour cent ») afin d'éviter que le tokenizer vocal ignore des caractères. Cette correction améliore
la stabilité mais ne transforme pas le checkpoint proxy en voix native : si l'audio reste incompréhensible,
il faut désactiver le bouton pour la démonstration plutôt que présenter une prononciation trompeuse.

Pour les réponses statistiques à une seule valeur, SamaStat utilise en priorité une formulation wolof
courte construite depuis l'enregistrement ANSD (`Dakar am na ... nit ci ...`) au lieu de faire traduire
librement toute la phrase française par NLLB-200. Cela réduit les erreurs grammaticales et donne au TTS
un texte plus simple à prononcer. Les valeurs restent celles de la base et ne sont jamais produites par
le modèle linguistique.

Le modèle `galsenai/xTTS-v2-wolof` est une piste ultérieure prometteuse, mais son checkpoint dépasse
7 Go, nécessite une stack Python/xTTS et une voix de référence, et sa documentation signale des
difficultés avec les nombres et le texte wolof-français mélangé. Il n'est pas retenu pour le déploiement
du hackathon sous 48 heures ; son intégration fera l'objet d'un service séparé après la soumission,
avec validation par un locuteur wolof.

Reconnaissance vocale web : le navigateur enregistre un court clip puis le backend le transmet à Groq
Whisper (`whisper-large-v3-turbo`) pour transcription. L'audio quitte donc le navigateur et est envoyé à
un fournisseur tiers ; l'interface l'indique avant l'enregistrement. Le français est demandé avec le code
`fr`. Pour le wolof, un prompt donne le contexte sénégalais et le serveur corrige quelques sorties
phonétiques connues avant la recherche (par exemple `Deni, nyodeg, dagar.` devient
`Ñaata nit ñoo dëkk Dakar ?`). La phrase corrigée reste visible afin que l'utilisateur puisse la relire.
Cette correction n'est pas un correcteur généraliste : les questions inconnues doivent toujours être relues
avant l'envoi.

Groq indique que les données de ses points de terminaison audio peuvent être conservées jusqu'à 30 jours
pour la fiabilité et la surveillance des abus, sauf configuration Zero Data Retention.

### Modèles ASR open source de référence pour le Wolof
- **`AIHubSN/Kiriku-Wolof-ASR`** (AI Hub Sénégal) : Modèle SOTA open source basé sur `whisper-large-v2`, entraîné sur 88 h de données vérifiées par des linguistes du CLAD (Centre de Linguistique Appliquée de Dakar), intégrant les diacritiques wolof (`ñ, ë, ŋ, ɗ, ɓ, ƴ`), WER de 20,7 %.
- **`AIHubSN/M-Kiriku-ASR`** (AI Hub Sénégal) : Variante multilingue (`whisper-large-v3`) pour le wolof, pulaar et sérère.
- **`M9and2M/whisper-small-wolof`** (licence MIT) : Variante légère basée sur `whisper-small`.
- En production/démonstration rapide, Groq Whisper (`whisper-large-v3-turbo`) est utilisé avec un amorçage lexical poussé (diacritiques, toponymes sénégalais, terminologie démographique et économique), couplé à la normalisation lexicale et à NLLB-200.

### Déploiement local prioritaire pour la démonstration ANSD

Le chemin Wolof vocal livré est maintenant un service ASR local séparé basé par défaut sur
`AIHubSN/kiriku-ASR`. Il utilise Python/PyTorch et se charge dans le volume Docker
`samastat-asr-models`. Le service peut utiliser un GPU CUDA lorsqu'il est disponible et
revient au CPU sinon. `HUGGINGFACE_HUB_TOKEN` peut être requis si l'accès au dépôt est
gated ; il doit être fourni uniquement dans l'environnement du serveur, jamais dans Git.

La stratégie est :

1. Groq Whisper est le chemin recommandé pour la dictée Wolof (`SAMASTAT_WOLOF_ASR_PROVIDER=groq`) ;
2. le choix vocal Wolof peut être envoyé au moteur Kiriku local uniquement avec
   `SAMASTAT_WOLOF_ASR_PROVIDER=local` ;
3. les variantes fréquentes de transcription (`Ndakaaru`, `njeg`, `liggeey`, etc.) sont
   normalisées uniquement pour la recherche ;
4. la question corrigée est affichée pour validation et le catalogue ANSD reste la seule source des valeurs ;
5. pour les questions françaises ou le mode automatique, le chemin Groq reste disponible si une clé est configurée.

Si `SOYNADE_API_KEY` est configurée, Soynade est prioritaire pour la synthèse vocale.
En cas d'échec, le serveur ne bascule pas automatiquement vers le modèle local expérimental
(`SOYNADE_TTS_FALLBACK_LOCAL=0` par défaut) : il vaut mieux afficher un bouton indisponible
que faire écouter une prononciation Wolof de mauvaise qualité. Le fallback local peut être
réactivé explicitement après test (`SOYNADE_TTS_FALLBACK_LOCAL=1`).

Le modèle `AIHubSN/M-Kiriku-ASR` reste une option pour une future version multilingue.

## Licences

NLLB-200 et le modèle vocal MMS sont sous **CC BY-NC 4.0** (usage non commercial). Compatible avec un service
public gratuit ; à signaler à l'ANSD dans la cession, avec l'alternative MIT ci-dessus. Les modèles sont
stockés localement dans `backend/.models` (volume `samastat-models` en Docker) et s'exécutent entièrement
sur CPU sans dépendance cloud.

## Modèles de langage et principe de non-invention

Le LLM wolof `soynade-research/Oolel-Small` (1,8 G) ou les modèles de discussion en wolof ne sont pas utilisés
pour générer les chiffres : conformément au principe non-négociable de SamaStat, aucun modèle ne produit
directement de valeurs numériques. Le modèle raisonne sur les outils, sélectionne les indicateurs certifiés
de l'ANSD, et la version wolof est produite par NLLB-200 sous sentinelles cryptographiques, garantissant 0 %
d'hallucination chiffrée en wolof comme en français.
