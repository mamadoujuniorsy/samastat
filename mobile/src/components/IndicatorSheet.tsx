import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError, exportUrl, fetchIndicatorDetail } from '../api';
import { radius, spacing, TOUCH, type, useTheme } from '../theme';
import type { IndicatorDetail } from '../types';
import { BarChart } from './BarChart';
import { IconButton } from './TopBar';

interface Props {
  indicatorId: string | null;
  onClose: () => void;
  onAsk: (question: string) => void;
}

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' });

function splitUnit(formatted: string, unit: string): [string, string] {
  if (unit === '%') return [formatted.replace(/\s*%$/, ''), '%'];
  const idx = formatted.lastIndexOf(` ${unit}`);
  return idx > 0 ? [formatted.slice(0, idx), unit] : [formatted, ''];
}

/** Fiche d'un enregistrement : chiffre, champ, source, séries par période et territoire, citation. */
export function IndicatorSheet({ indicatorId, onClose, onAsk }: Props) {
  const { palette } = useTheme();
  const [detail, setDetail] = useState<IndicatorDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!indicatorId) return;
    let cancelled = false;
    setDetail(null);
    setError(null);
    setCopied(false);
    fetchIndicatorDetail(indicatorId)
      .then((d) => !cancelled && setDetail(d))
      .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : 'Fiche indisponible.'));
    return () => {
      cancelled = true;
    };
  }, [indicatorId]);

  const r = detail?.record;
  const [num, unit] = r ? splitUnit(r.formattedValue, r.unit) : ['', ''];
  const ids = detail ? [...new Set([detail.record.id, ...detail.byPeriod.map((x) => x.id), ...detail.byTerritory.map((x) => x.id)])] : [];

  return (
    <Modal visible={indicatorId !== null} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]} edges={['top', 'bottom']}>
        <View style={[styles.head, { borderBottomColor: palette.border }]}>
          <Text style={[type.small, { color: palette.textMuted, flex: 1 }]}>Fiche de l&apos;indicateur</Text>
          <IconButton label="Fermer" icon="x" onPress={onClose} color={palette.text} />
        </View>

        {error ? (
          <View style={styles.body}>
            <Text style={[type.small, { color: palette.danger, fontWeight: '600' }]}>Fiche indisponible</Text>
            <Text style={[type.small, { color: palette.text }]}>{error}</Text>
          </View>
        ) : !detail || !r ? (
          <View style={[styles.body, { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }]}>
            <ActivityIndicator color={palette.textMuted} />
            <Text style={[type.small, { color: palette.textMuted }]}>Chargement de la fiche…</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={[type.small, { color: palette.textMuted }]}>{r.name}</Text>
            <View style={styles.headline}>
              <Text style={[styles.headlineValue, { color: palette.text }]}>{num}</Text>
              <Text style={[type.body, { color: palette.textMuted }]}>{unit}</Text>
            </View>
            <Text style={[type.body, { color: palette.text, fontWeight: '600' }]}>
              {r.territory} · {r.period}
            </Text>
            {r.description ? <Text style={[type.small, { color: palette.textMuted }]}>{r.description}</Text> : null}

            <View style={[styles.block, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Line label="Champ" value={`${r.territory}, ${r.period}`} />
              <Line label="Source" value={r.source} />
              <Line label="Vérifié le" value={r.verified_at ? dateFormat.format(new Date(r.verified_at)) : '—'} />
              <Line label="Identifiant" value={r.id} mono />
              <View style={styles.actions}>
                <TextAction
                  label={copied ? 'Citation copiée' : 'Copier la citation'}
                  onPress={async () => {
                    await Clipboard.setStringAsync(detail.citation);
                    setCopied(true);
                  }}
                />
                <TextAction label={`Page d'origine (${r.platform})`} onPress={() => void Linking.openURL(r.url)} />
                <TextAction label="CSV des séries" onPress={() => void Linking.openURL(exportUrl(ids, 'csv'))} />
              </View>
            </View>

            {detail.evolution && <BarChart chart={detail.evolution} />}
            {detail.comparison && <BarChart chart={detail.comparison} />}

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onClose();
                onAsk(`${r.name} ${r.territory} ${r.period}`);
              }}
              style={({ pressed }) => [styles.askButton, { backgroundColor: palette.accent }, pressed && { opacity: 0.8 }]}
            >
              <Text style={[type.small, { color: palette.onAccent, fontWeight: '600' }]}>Poser une question à partir de cet indicateur</Text>
            </Pressable>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function Line({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const { palette } = useTheme();
  return (
    <Text style={[type.small, { color: palette.text }]}>
      <Text style={{ color: palette.textMuted }}>{label} : </Text>
      <Text style={mono ? { fontFamily: 'monospace', fontSize: 12 } : undefined}>{value}</Text>
    </Text>
  );
}

function TextAction({ label, onPress }: { label: string; onPress: () => void }) {
  const { palette } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={6} style={({ pressed }) => [{ minHeight: TOUCH, justifyContent: 'center' }, pressed && { opacity: 0.6 }]}>
      <Text style={[type.caption, { color: palette.accent, textDecorationLine: 'underline' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: { padding: spacing.lg, gap: spacing.md },
  headline: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  headlineValue: { fontSize: 36, lineHeight: 40, fontWeight: '600', fontVariant: ['tabular-nums'] },
  block: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, marginTop: spacing.xs },
  askButton: { minHeight: TOUCH, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
});
