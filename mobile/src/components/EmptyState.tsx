import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, spacing, TOUCH, type, useTheme } from '../theme';
import type { IndicatorSummary } from '../types';

interface Props {
  catalogue: IndicatorSummary[] | null;
  health: { indicators: number; surveys: number } | null;
  onPick: (question: string) => void;
}

/** Transforme un indicateur du catalogue en question réelle que le système sait traiter. */
function toQuestion(i: IndicatorSummary): string {
  const where = i.territory === 'Sénégal' ? 'au Sénégal' : `dans la ${i.territory.replace(/^Région de /, 'région de ')}`;
  const name = i.name.charAt(0).toLowerCase() + i.name.slice(1);
  if (/^population/.test(name)) return `Quelle est la ${name} ${where} en ${i.period} ?`;
  if (/^taux/.test(name)) return `Quel est le ${name} ${where} en ${i.period} ?`;
  if (/^indice/.test(name)) return `Quel est l'${name} ${where} en ${i.period} ?`;
  return `Quelle est l'${name} ${where} en ${i.period} ?`;
}

function pickExamples(catalogue: IndicatorSummary[]): string[] {
  const seen = new Set<string>();
  const picked: string[] = [];
  for (const i of catalogue) {
    if (seen.has(i.name)) continue;
    seen.add(i.name);
    picked.push(toQuestion(i));
    if (picked.length === 4) break;
  }
  return picked;
}

export function EmptyState({ catalogue, health, onPick }: Props) {
  const { palette } = useTheme();
  const examples = catalogue ? pickExamples(catalogue) : [];

  return (
    <View style={styles.wrap}>
      <Text style={[type.title, { color: palette.text }]}>Que voulez-vous savoir sur le Sénégal ?</Text>
      <Text style={[type.body, { color: palette.textMuted, marginTop: spacing.md }]}>
        SamaStat répond avec les chiffres publiés par l&apos;ANSD, jamais avec une estimation. Chaque valeur
        est accompagnée de sa source, de sa période et de sa date de vérification.
      </Text>
      {health && (
        <Text style={[type.caption, { color: palette.textMuted, marginTop: spacing.sm }]}>
          {health.indicators} indicateurs et {health.surveys} enquêtes ANADS indexés.
        </Text>
      )}

      {catalogue === null ? (
        <Text style={[type.small, { color: palette.textMuted, marginTop: spacing.xl }]} accessibilityLiveRegion="polite">
          Chargement du catalogue…
        </Text>
      ) : examples.length === 0 ? (
        <Text style={[type.small, { color: palette.textMuted, marginTop: spacing.xl }]} accessibilityRole="alert">
          Le catalogue est injoignable. Vérifiez que l&apos;API est démarrée et que son adresse est bien
          configurée, puis ouvrez une nouvelle conversation.
        </Text>
      ) : (
        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          {examples.map((q) => (
            <Pressable
              key={q}
              accessibilityRole="button"
              onPress={() => onPick(q)}
              style={({ pressed }) => [
                styles.chip,
                { backgroundColor: palette.surface, borderColor: palette.border },
                pressed && { backgroundColor: palette.surfaceMuted },
              ]}
            >
              <Text style={[type.small, { color: palette.text }]}>{q}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.xxl },
  chip: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: TOUCH,
    justifyContent: 'center',
  },
});
