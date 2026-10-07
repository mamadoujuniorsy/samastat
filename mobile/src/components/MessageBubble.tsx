import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { permalinkUrl } from '../api';
import { radius, spacing, TOUCH, type, useTheme } from '../theme';
import type { AskResponse, CitedRecord, Message } from '../types';
import { BarChart } from './BarChart';
import { SourceCard } from './SourceCard';
import { StepsPanel } from './StepsPanel';
import { WolofAnswer } from './WolofAnswer';

interface Props {
  message: Message;
  pending: boolean;
  speaking: boolean;
  onToggleSpeak: (id: string, text: string, language?: 'fr' | 'wo') => void;
  onAsk: (q: string) => void;
  onRetry: (assistantMessageId: string) => void;
  onOpenIndicator: (id: string) => void;
}

const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' });

/** Texte partagé : réponse + chaque valeur avec sa source et son lien, + attribution. */
function shareText(r: AskResponse): string {
  const lines = [r.answer, ''];
  for (const d of r.data) {
    lines.push(`${d.name} — ${d.territory}, ${d.period} : ${d.formattedValue}`);
    lines.push(`Source : ${d.source} — ${d.url}`);
  }
  for (const s of r.surveys) lines.push(`Enquête ANADS : ${s.label} — ${s.url}`);
  const link = permalinkUrl(r.meta.permalink);
  lines.push('', `Réponse SamaStat du ${dateTimeFormat.format(new Date(r.meta.retrievedAt))}.${link ? ` ${link}` : ''}`, r.meta.attribution);
  return lines.join('\n');
}

function citationFor(r: CitedRecord): string {
  return `ANSD, « ${r.name} », ${r.territory}, ${r.period} : ${r.formattedValue}. ${r.source}. ${r.url} (consulté le ${dateFormat.format(new Date())} via SamaStat).`;
}

function splitUnit(formatted: string, unit: string): [string, string] {
  if (unit === '%') return [formatted.replace(/\s*%$/, ''), '%'];
  const idx = formatted.lastIndexOf(` ${unit}`);
  return idx > 0 ? [formatted.slice(0, idx), unit] : [formatted, ''];
}

export function MessageBubble({ message, pending, speaking, onToggleSpeak, onAsk, onRetry, onOpenIndicator }: Props) {
  const { palette } = useTheme();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showAllSources, setShowAllSources] = useState(false);

  if (message.role === 'user') {
    return (
      <View style={styles.userRow}>
        <View style={[styles.userBubble, { backgroundColor: palette.userBubble }]}>
          <Text style={[type.body, { color: palette.text }]}>{message.text}</Text>
        </View>
      </View>
    );
  }

  const { response, transportError, steps, aborted } = message;

  if (aborted) {
    return (
      <View style={styles.assistantRow}>
        <Text style={[type.small, { color: palette.textMuted }]}>Question interrompue avant la réponse.</Text>
        <TextAction label="Relancer" onPress={() => onRetry(message.id)} />
      </View>
    );
  }

  if (transportError) {
    return (
      <View style={styles.assistantRow}>
        <View style={[styles.alert, { backgroundColor: palette.dangerSoft }]} accessibilityRole="alert">
          <Text style={[type.small, { color: palette.danger, fontWeight: '600' }]}>La réponse n&apos;a pas pu être obtenue</Text>
          <Text style={[type.small, { color: palette.text, marginTop: 2 }]}>{transportError}</Text>
          <TextAction label="Réessayer" onPress={() => onRetry(message.id)} />
        </View>
      </View>
    );
  }

  if (!response) {
    return (
      <View style={styles.assistantRow}>
        <Text style={[type.caption, { color: palette.textMuted }]}>SamaStat</Text>
        <StepsPanel steps={steps} live={pending} />
      </View>
    );
  }

  if (response.status === 'error') {
    return (
      <View style={styles.assistantRow}>
        <View style={[styles.alert, { backgroundColor: palette.dangerSoft }]} accessibilityRole="alert">
          <Text style={[type.small, { color: palette.danger, fontWeight: '600' }]}>Le service n&apos;a pas pu répondre</Text>
          <Text style={[type.small, { color: palette.text, marginTop: 2 }]}>{response.answer}</Text>
          <TextAction label="Réessayer" onPress={() => onRetry(message.id)} />
        </View>
      </View>
    );
  }

  const single = response.status === 'answered' && response.data.length === 1 ? response.data[0] : null;
  const sources = showAllSources || response.data.length <= 4 ? response.data : response.data.slice(0, 3);
  const say = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 1800);
  };

  return (
    <View style={styles.assistantRow}>
      <Text style={[type.caption, { color: palette.textMuted }]}>SamaStat</Text>

      {single && <Headline record={single} />}

      {response.answerWolof ? (
        <WolofAnswer wolof={response.answerWolof} french={response.answer} />
      ) : (
        <Text style={[type.body, { color: palette.text }]} selectable>
          {response.answer}
        </Text>
      )}

      {response.status === 'no_data' && (
        <View style={[styles.noData, { backgroundColor: palette.surfaceMuted }]}>
          <Text style={[type.small, { color: palette.text, fontWeight: '600' }]}>Cette donnée n&apos;est pas dans le catalogue.</Text>
          <Text style={[type.small, { color: palette.textMuted, marginTop: 2 }]}>
            SamaStat ne propose jamais d&apos;estimation à la place d&apos;une valeur officielle.
          </Text>
          {response.suggestions.length > 0 && (
            <View style={styles.chips}>
              {response.suggestions.map((s) => (
                <Chip key={s} label={s} onPress={() => onAsk(s)} disabled={pending} />
              ))}
            </View>
          )}
        </View>
      )}

      {response.chart && <BarChart chart={response.chart} />}

      {sources.length > 0 && (
        <View style={styles.sources}>
          {sources.map((d) => (
            <SourceCard key={d.indicatorId} record={d} onOpen={() => onOpenIndicator(d.indicatorId)} />
          ))}
          {response.data.length > 4 && (
            <TextAction
              label={showAllSources ? 'Réduire les sources' : `Voir les ${response.data.length} sources`}
              onPress={() => setShowAllSources((v) => !v)}
            />
          )}
        </View>
      )}

      {response.surveys?.length > 0 && (
        <View style={[styles.noData, { backgroundColor: palette.surfaceMuted }]}>
          <Text style={[type.caption, { color: palette.textMuted }]}>Enquêtes ANADS liées (métadonnées)</Text>
          {response.surveys.map((s) => (
            <TextAction key={s.idno} label={s.label} onPress={() => void Linking.openURL(s.url)} />
          ))}
        </View>
      )}

      {response.status !== 'conversation' && (
        <View style={styles.actions} accessibilityRole="toolbar">
          <ActionLink
            icon={speaking ? 'square' : 'volume-2'}
            label={speaking ? 'Arrêter' : 'Écouter'}
            active={speaking}
            onPress={() => {
              const lang = response.meta.language === 'wo' ? 'wo' : 'fr';
              const text = lang === 'wo' && response.answerWolof ? response.answerWolof : response.answer;
              onToggleSpeak(message.id, text, lang);
            }}
          />
          <ActionLink
            icon="copy"
            label="Copier"
            onPress={async () => {
              await Clipboard.setStringAsync(shareText(response));
              say('Réponse copiée');
            }}
          />
          {response.data.length > 0 && (
            <ActionLink
              icon="bookmark"
              label="Citer"
              onPress={async () => {
                await Clipboard.setStringAsync(response.data.map(citationFor).join('\n'));
                say('Citation copiée');
              }}
            />
          )}
          <ActionLink icon="share-2" label="Partager" onPress={() => void Share.share({ message: shareText(response) }).catch(() => undefined)} />
        </View>
      )}
      {feedback && (
        <Text style={[type.caption, { color: palette.textMuted }]} accessibilityLiveRegion="polite">
          {feedback}
        </Text>
      )}

      {response.followUps?.length > 0 && (
        <View style={styles.chips}>
          {response.followUps.map((f) => (
            <Chip key={f.question} label={f.label} onPress={() => onAsk(f.question)} disabled={pending} />
          ))}
        </View>
      )}

      <StepsPanel steps={steps} live={false} />
      <Text style={[type.caption, { color: palette.textMuted }]}>
        Récupéré en base le {dateTimeFormat.format(new Date(response.meta.retrievedAt))}
        {response.meta.cached ? ' · servie depuis le cache' : ''}
        {response.meta.guard === 'fallback' ? ' · formulation libre rejetée par la garde, texte reconstruit depuis la base' : ''}.
      </Text>
    </View>
  );
}

function Headline({ record }: { record: CitedRecord }) {
  const { palette } = useTheme();
  const [num, unit] = splitUnit(record.formattedValue, record.unit);
  return (
    <View style={[styles.headline, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Text style={[type.small, { color: palette.textMuted }]}>{record.name}</Text>
      <View style={styles.headlineRow}>
        <Text style={[styles.headlineValue, { color: palette.text }]}>{num}</Text>
        <Text style={[type.body, { color: palette.textMuted }]}>{unit}</Text>
      </View>
      <Text style={[type.small, { color: palette.textMuted }]}>
        Champ : {record.territory} · {record.period}
      </Text>
    </View>
  );
}

function Chip({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { palette } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled ?? false }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.chip, { borderColor: palette.borderStrong, backgroundColor: palette.surface }, pressed && { opacity: 0.6 }, disabled && { opacity: 0.5 }]}
    >
      <Text style={[type.small, { color: palette.text }]}>{label}</Text>
    </Pressable>
  );
}

function TextAction({ label, onPress }: { label: string; onPress: () => void }) {
  const { palette } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={6} style={({ pressed }) => [{ minHeight: 32, justifyContent: 'center' }, pressed && { opacity: 0.6 }]}>
      <Text style={[type.small, { color: palette.accent, textDecorationLine: 'underline' }]}>{label}</Text>
    </Pressable>
  );
}

function ActionLink({ icon, label, active, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; active?: boolean; onPress: () => void }) {
  const { palette } = useTheme();
  const color = active ? palette.accent : palette.textMuted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active ?? false }}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
    >
      <Feather name={icon} size={16} color={color} />
      <Text style={[type.caption, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  userRow: { alignItems: 'flex-end', paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  userBubble: {
    maxWidth: '85%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderBottomRightRadius: radius.sm,
  },
  assistantRow: { paddingHorizontal: spacing.lg, marginTop: spacing.lg, gap: spacing.md },
  alert: { borderRadius: radius.md, padding: spacing.md },
  noData: { borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 36, justifyContent: 'center' },
  sources: { gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: TOUCH - 12 },
  headline: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  headlineRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  headlineValue: { fontSize: 34, lineHeight: 38, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
