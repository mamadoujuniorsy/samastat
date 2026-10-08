import { Feather } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { wolofTtsUrl } from '../api';
import { spacing, type, useTheme } from '../theme';

/**
 * Version wolof d'une réponse (traduction locale, valeurs protégées) avec lecture par la voix
 * wolof du serveur. Le français reste affiché dessous, en retrait.
 */
export function WolofAnswer({ wolof, french }: { wolof: string; french: string }) {
  const { palette } = useTheme();
  const player = useAudioPlayer({ uri: wolofTtsUrl(wolof) });
  const status = useAudioPlayerStatus(player);
  const playing = status.playing;

  const toggle = () => {
    if (playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish || status.currentTime >= (status.duration || 0)) player.seekTo(0);
    player.play();
  };

  return (
    <View style={styles.wrap}>
      <Text style={[type.body, { color: palette.text }]} selectable accessibilityLanguage="wo">
        {wolof}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Arrêter la lecture wolof' : 'Écouter en wolof, voix expérimentale'}
        accessibilityState={{ selected: playing }}
        onPress={toggle}
        hitSlop={6}
        style={({ pressed }) => [styles.listen, pressed && { opacity: 0.6 }]}
      >
        <Feather name={playing ? 'square' : 'volume-2'} size={16} color={playing ? palette.accent : palette.textMuted} />
        <Text style={[type.caption, { color: playing ? palette.accent : palette.textMuted }]}>
          {playing ? 'Arrêter' : 'Écouter en wolof (voix expérimentale)'}
        </Text>
      </Pressable>
      <Text style={[type.small, { color: palette.textMuted }]} selectable accessibilityLanguage="fr">
        {french}
      </Text>
      <Text style={[type.caption, { color: palette.textMuted }]}>
        Wolof produit par traduction automatique locale ; les valeurs, périodes et sources ne passent pas par le traducteur.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  listen: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 32, alignSelf: 'flex-start' },
});
