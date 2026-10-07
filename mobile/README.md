# SamaStat — application mobile (Expo / React Native)

Canal principal de SamaStat : un chat, une question au clavier ou à la voix, une réponse chiffrée
lue à voix haute si on le souhaite, et sous chaque valeur sa source, sa période et le lien ANSD.

## Fonctions

- Fil de conversation, historique conservé sur l'appareil uniquement, nouvelle conversation
- Dictée de la question (moteur vocal du système en français : Siri sur iOS, Google sur Android),
  envoi automatique à la fin de la dictée
- Lecture à voix haute de chaque réponse (bouton « Écouter » ou lecture automatique via l'icône
  haut-parleur de la barre supérieure)
- Contexte de conversation envoyé à l'API : « et à Thiès ? » est compris après une question sur Dakar
- Évolutions et comparaisons rendues en barres proportionnelles, chaque barre étant un enregistrement ANSD
- États explicites : recherche en cours, donnée absente avec reformulations, erreur réseau
- Mode clair par défaut, sombre selon le réglage du téléphone

## Lancer

```bash
cp .env.example .env         # adapter EXPO_PUBLIC_API_URL à votre réseau
npm start                    # depuis mobile/ ; ou npm run dev:mobile à la racine
```

**Dictée vocale : build de développement obligatoire.** Le module `expo-speech-recognition`
contient du code natif absent d'Expo Go. Dans Expo Go, l'app fonctionne mais le bouton micro
n'apparaît pas. Pour l'activer :

```bash
npx expo run:android         # ou npx expo run:ios sur macOS
```

Les dossiers `android/` et `ios/` générés sont ignorés par git (génération native continue).

## Vérifier

```bash
npx tsc --noEmit
npx expo export --platform android   # compile le bundle sans appareil
```

## Structure

```text
App.tsx                       point d'entrée
src/screens/ChatScreen.tsx    écran unique : barre, fil, saisie, historique
src/components/               TopBar, Composer, MessageBubble, SourceCard, EmptyState, HistorySheet
src/hooks/useConversations    état des conversations et envoi à l'API
src/hooks/useVoiceInput       dictée (chargement conditionnel du module natif)
src/hooks/useSpeaker          synthèse vocale (expo-speech)
src/api.ts                    appels à POST /ask et GET /indicators
src/theme.ts                  tokens de couleur, espacements, typographie
```
