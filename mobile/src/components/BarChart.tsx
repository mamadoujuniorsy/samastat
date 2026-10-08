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
            <View style={styles.heading}>
              <Text style={[type.caption, styles.label, { color: palette.textMuted }]}>{p.label}</Text>
              <Text style={[type.small, styles.value, { color: palette.text }]}>{p.formattedValue}</Text>
            </View>
            <View style={[styles.track, { backgroundColor: palette.surfaceMuted }]}>
              <View
                style={[
                  styles.bar,
                  { width: `${ratio * 100}%`, backgroundColor: p.value < 0 ? palette.danger : palette.accent },
                ]}
              />
            </View>
          </View>
        );
      })}
      <Text style={[type.caption, { color: palette.textMuted, marginTop: spacing.sm }]}>Longueur relative à la plus grande valeur absolue ; les valeurs négatives portent le signe − et sont en rouge.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  row: { gap: spacing.xs, marginTop: spacing.sm },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { flex: 1 },
  track: { height: 12, borderRadius: radius.sm, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: radius.sm },
  value: { flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
