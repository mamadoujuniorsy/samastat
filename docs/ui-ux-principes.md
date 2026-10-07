# Principes UI/UX de SamaStat

Ce document liste les anti-patterns des interfaces « vibe-codées » (générées à la va-vite par IA)
et la règle que SamaStat applique à la place. Il sert de checklist de revue pour chaque écran.

Sources consultées (septembre 2026) : developersdigest.tech (AI design slop), JCarterJohnson/vibecoded-design-tells,
thecrit.co (vibe coding design guide), blog.vibecoder.me (empty/loading/error states),
taylorarndt.substack.com (tests d'accessibilité d'apps vibe-codées), axonbuild.com (audit de 26 apps),
appinstitute.com (performance mobile).

## A. Visuel

| Anti-pattern | Règle SamaStat |
|---|---|
| Dégradé violet → bleu partout | Une seule couleur d'accent (vert profond, clin d'œil au drapeau sans le singer), neutres légèrement chauds |
| Inter / Space Grotesk / italique serif d'accent | Une police de texte lisible + une police à chiffres tabulaires pour les valeurs |
| Dark mode permanent, gris moyen à contraste limite | Mode clair par défaut, contraste ≥ 4.5:1, dark mode suivant le système |
| Glows, ombres colorées, glassmorphism | Bordures fines, ombres uniquement sur les éléments flottants |
| Emoji en guise d'icônes, badge ✨ | Pas d'emoji dans l'interface ; icônes SVG sobres ou texte |
| Même border-radius et « card » partout | Rayons différenciés ; la carte est réservée à un objet manipulable (une réponse) |
| Labels en MAJUSCULES + badge coloré au-dessus du H1 | Casse normale ; un badge seulement s'il porte une information (source, période) |

## B. Structure

| Anti-pattern | Règle SamaStat |
|---|---|
| Hero centré + 3 cartes de fonctionnalités | Pas de page marketing : l'écran d'accueil EST le champ de question |
| Bandeau de stats, « 1-2-3 étapes », logos, témoignages | Rien de tout cela |
| Espacement uniforme | Serré entre éléments liés (valeur / unité / période), large entre réponses |
| Dashboard « pour faire pro » avec KPI vides | Aucun tableau de bord tant qu'il n'y a pas de données d'usage réelles |
| Tout centré | Texte aligné à gauche ; seul l'état vide initial est centré |

## C. Interaction

| Anti-pattern | Règle SamaStat |
|---|---|
| Pas d'état loading / error / empty | Trois états explicites, écrits en français clair, avec l'action suivante |
| Erreurs silencieuses ou seulement visuelles | Message texte + `role="alert"` ; le focus revient au champ |
| Focus perdu, navigation clavier absente | Entrée envoie, Maj+Entrée saut de ligne, focus visible, ordre de tabulation logique |
| États uniquement visuels | `aria-pressed`, `aria-busy`, `aria-live` sur la zone de réponse |
| Mobile cassé | Cibles ≥ 44 px, champ de saisie ancré en bas, testé à 400 px |
| Boutons factices, « coming soon » | Aucun bouton sans action réelle ; les jalons futurs ne sont pas dans l'UI |
| Aucun feedback après action | La question apparaît immédiatement dans le fil, la réponse en attente est signalée |

## D. Contenu

| Anti-pattern | Règle SamaStat |
|---|---|
| « Seamless », « Supercharge », « AI-powered » | Phrases concrètes : ce que l'outil répond, à partir de quelles données |
| Lorem, « John Doe », faux témoignages, « 10 000+ users » | Interdit |

## E. Confiance (cœur du projet)

| Anti-pattern | Règle SamaStat |
|---|---|
| Données démo présentées comme réelles | Chaque valeur est reliée à un enregistrement de la base, lui-même relié à une URL ANSD |
| Aucune source, aucune date | Chaque réponse affiche : identifiant d'indicateur, source, période, horodatage de récupération, lien |
| Le modèle « complète » quand il ne sait pas | Réponse explicite « je n'ai pas cette donnée » + reformulations proposées, jamais d'estimation |
