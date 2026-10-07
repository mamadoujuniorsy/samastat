# SamaStat — direction produit web

## Produit

SamaStat est un assistant de statistiques publiques sénégalaises et un outil de repérage des besoins pour les équipes ANSD. L’expérience publique commence par une question, comme les assistants conversationnels familiers, tout en gardant visibles les sources, le champ géographique, la période et les limites des données. La marque ANSD inspire une palette bleue sobre ; son logo et la mise en page de son site ne sont pas repris.

## Parcours public

- Une seule action principale : poser une question en français ou en wolof.
- La dictée vocale enregistre avec le micro du navigateur puis envoie l’audio à Groq Whisper côté serveur. L’interface informe avant usage de ce transfert à un tiers. Le texte reconnu reste modifiable avant envoi. La transcription wolof est expérimentale et ne doit pas être présentée comme fiable sans évaluation locale.
- L’accueil contient quelques exemples représentatifs, l’accès au catalogue, à la méthode et une indication honnête de la couverture actuelle. Pas de tuiles KPI décoratives.
- Après envoi, la question et sa réponse partagent une colonne de lecture. Les étapes affichées correspondent au traitement réel. L’utilisateur peut interrompre, réessayer, copier, écouter ou ouvrir les sources.
- Une réponse chiffrée expose valeur, unité, période, territoire, source et avertissement de périmètre. Une absence de donnée suggère une reformulation ou une exploration des publications disponibles.
- L’historique local est clairement limité au navigateur et à une session. « Nouvelle question » démarre une session vierge.

## Parcours ANSD

Le tableau de bord aide à prioriser le catalogue : volume de questions, réponses avec valeur, demandes sans donnée, thèmes, langues, indicateurs mobilisés et chronologie, avec fenêtres 7/30/90 jours et exports CSV. Les cartes KPI ne sont affichées que lorsque des données existent.

Les regroupements territoriaux actuels sont dérivés des indicateurs associés aux réponses. Ils ne mesurent pas toute la demande géographique : l’interface doit le dire à proximité de la carte. Les questions enregistrées sont du texte libre, même sans identifiant de compte ; l’interface n’affirme donc pas une anonymisation complète et déconseille de saisir des renseignements personnels.

## Style visuel

- Bleu ANSD comme repère de marque, sans prétendre disposer d’un guide officiel des couleurs ; neutres chauds, texte foncé, une couleur d’action.
- Clair par défaut et thème sombre accessible. Pas de dégradés, lueurs, glassmorphism, décoration IA ou animation superflue.
- Sans-serif pour les contrôles, titres lisibles et hiérarchie nette, tabular numbers pour les valeurs.
- Contenu public limité à une colonne confortable ; tableau de bord responsive. Libellés de graphiques lisibles sur téléphone, cibles tactiles d’au moins 44 px, focus clavier net, états de chargement/absence/erreur explicites.
- Couleurs de graphiques cohérentes, axes honnêtes et zéro visible. Toujours associer couleur et libellé.

## Palette de l’interface

| Rôle | Clair | Sombre |
|---|---|---|
| Fond | `#f6f4ee` | `#141517` |
| Surface | `#ffffff` | `#1e2024` |
| Texte | `#171613` | `#ecebe6` |
| Accent bleu | `#175c91` | `#83b8e3` |
| Danger | `#9b1c1c` | `#f08a8a` |

Le contraste du texte courant respecte WCAG AA. Ne pas employer le texte atténué pour une instruction essentielle. Privilégier la réduction de mouvement du système.

## Limites produit à traiter avant toute promesse

- La dictée utilise actuellement Groq Whisper. La reconnaissance wolof reste expérimentale : elle nécessite une évaluation avec des locuteurs et accents locaux et une mesure d’erreur publiée avant toute promesse de fiabilité.
- Le catalogue d’indicateurs et la recherche sont bornés par les données validées et indexées ; les microdonnées des enquêtes ne sont pas ouvertes par le chat.
- Le tableau de bord ne peut pas mesurer les territoires demandés si ceux-ci ne sont pas associés à un indicateur retourné. Un futur événement analytique pourra enregistrer des catégories géographiques extraites après revue de confidentialité.
- L’aide à la décision décrit des tendances d’usage et des lacunes de couverture ; elle ne déduit pas à elle seule des priorités de politique publique.
