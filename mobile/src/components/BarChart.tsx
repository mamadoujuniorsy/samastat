import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, type, useTheme } from '../theme';
import type { ChartHint } from '../types';

/**
 * Barres horizontales proportionnelles, sans bibliothèque : chaque barre est un
 * enregistrement de la base, la longueur est relative au maximum de la série.
 */
export function BarChart({ chart }: { chart: ChartHint }) {
  const { palette } = useTheme();
  const max = Math.max(...chart.points.map((p) => Math.abs(p.value)), 0);
  const kindLabel = chart.kind === 'evolution' ? 'Évolution' : 'Comparaison';

  return (
    <View
      style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
      accessibilityRole="summary"
      accessibilityLabel={`${kindLabel} : ${chart.title}. ${chart.points.map((p) => `${p.label} ${p.formattedValue}`).join(', ')}`}
    >
      <Text style={[type.caption, { color: palette.textMuted }]}>{kindLabel}</Text>
      <Text style={[type.small, { color: palette.text, fontWeight: '600', marginBottom: spacing.sm }]}>{chart.title}</Text>
      {chart.points.map((p) => {
        const ratio = max > 0 ? Math.abs(p.value) / max : 0;
        return (
          <View key={p.indicatorId} style={styles.row}>
            <Text numberOfLines={1} style={[type.caption, styles.label, { color: palette.textMuted }]}>
              {p.label}
            </Text>
            <View style={[styles.track, { backgroundColor: palette.surfaceMuted }]}>
              <View
                style={[
                  styles.bar,
                  { width: `${Math.max(ratio * 100, 2)}%`, backgroundColor: p.value < 0 ? palette.danger : palette.accent },
                ]}
              />
            </View>
            <Text style={[type.small, styles.value, { color: palette.text }]}>{p.formattedValue}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  label: { width: 92 },
  track: { flex: 1, height: 12, borderRadius: radius.sm, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: radius.sm },
  value: { minWidth: 90, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
