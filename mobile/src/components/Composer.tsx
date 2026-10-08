import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { radius, spacing, TOUCH, type, useTheme } from '../theme';
import type { VoiceInput } from '../hooks/useVoiceInput';
import { IconButton } from './TopBar';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  pending: boolean;
  voice: VoiceInput;
  autoSendAfterDictation: boolean;
}

const MAX_LENGTH = 500;

/**
 * Zone de saisie : texte ou dictée. Pendant la dictée, le texte reconnu remplit le champ en direct.
 * Pendant le traitement, le bouton Envoyer devient Arrêter.
 */
export function Composer({ value, onChange, onSend, onStop, pending, voice, autoSendAfterDictation }: Props) {
  const { palette } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (voice.listening) onChange(voice.transcript);
  }, [voice.listening, voice.transcript, onChange]);

  const canSend = value.trim().length >= 2 && !pending && !voice.listening && !voice.transcribing;

  const submit = () => {
    if (!canSend) return;
    onSend(value);
    inputRef.current?.focus();
  };

  return (
    <View style={styles.wrap}>
      {voice.error && (
        <Text accessibilityRole="alert" style={[type.small, styles.error, { color: palette.danger }]}>
          {voice.error}
        </Text>
      )}
      <View
        style={[
          styles.box,
          {
            backgroundColor: palette.surface,
            borderColor: focused || voice.listening ? palette.borderStrong : palette.border,
          },
        ]}
      >
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={(t) => onChange(t.slice(0, MAX_LENGTH))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          multiline
          maxLength={MAX_LENGTH}
          editable={!voice.listening && !voice.transcribing}
          placeholder={
            voice.listening
              ? 'Je vous écoute… (wolof ou français)'
              : voice.transcribing
                ? 'Transcription en cours…'
                : 'Posez une question sur le Sénégal'
          }
          placeholderTextColor={palette.textMuted}
          accessibilityLabel="Votre question"
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={submit}
          style={[type.body, styles.input, { color: palette.text }]}
        />
        <View style={styles.actions}>
          {voice.listening ? (
            <>
              <IconButton label="Annuler la dictée" icon="x" onPress={voice.cancel} color={palette.textMuted} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Terminer la dictée"
                onPress={voice.stop}
                style={[styles.round, { backgroundColor: palette.danger }]}
              >
                <Feather name="square" size={18} color={palette.onAccent} />
              </Pressable>
            </>
          ) : voice.transcribing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Transcription en cours"
              disabled
              style={[styles.round, { backgroundColor: palette.surfaceMuted, borderWidth: 1, borderColor: palette.border }]}
            >
              <Feather name="loader" size={16} color={palette.textMuted} />
            </Pressable>
          ) : pending ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Arrêter la question en cours"
              onPress={onStop}
              style={[styles.round, { backgroundColor: palette.surfaceMuted, borderWidth: 1, borderColor: palette.borderStrong }]}
            >
              <Feather name="square" size={16} color={palette.text} />
            </Pressable>
          ) : (
            <>
              {voice.available && (
                <IconButton label="Dicter la question" icon="mic" onPress={() => void voice.start()} color={palette.text} />
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Envoyer la question"
                accessibilityState={{ disabled: !canSend }}
                onPress={submit}
                disabled={!canSend}
                style={[styles.round, { backgroundColor: canSend ? palette.accent : palette.surfaceMuted }]}
              >
                <Feather name="arrow-up" size={20} color={canSend ? palette.onAccent : palette.textMuted} />
              </Pressable>
            </>
          )}
        </View>
      </View>
      {voice.listening && (
        <Text style={[type.caption, styles.hint, { color: palette.textMuted }]} accessibilityLiveRegion="polite">
          Parlez en wolof ou en français, puis appuyez sur le carré. {autoSendAfterDictation ? 'Le texte sera envoyé automatiquement.' : 'Relisez le texte avant de l’envoyer.'}
        </Text>
      )}
      {voice.transcribing && (
        <Text style={[type.caption, styles.hint, { color: palette.textMuted }]} accessibilityLiveRegion="polite">
          Transcription du vocal…
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  box: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  input: { flex: 1, minHeight: TOUCH, maxHeight: 140, paddingVertical: spacing.sm, paddingRight: spacing.sm },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingBottom: 2 },
  round: { width: TOUCH, height: TOUCH, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  error: { marginBottom: spacing.sm, marginHorizontal: spacing.xs },
  hint: { marginTop: spacing.sm, marginHorizontal: spacing.xs },
});
