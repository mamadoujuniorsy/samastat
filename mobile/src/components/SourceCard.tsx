import { Feather } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, spacing, type, useTheme } from '../theme';
import type { CitedRecord } from '../types';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });

/** Une valeur citée et sa traçabilité : indicateur, champ, source, vérification, lien ; touche → fiche. */
export function SourceCard({ record, onOpen }: { record: CitedRecord; onOpen: () => void }) {
  const { palette } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir la fiche ${record.name}, ${record.territory}, ${record.period}`}
      onPress={onOpen}
      style={({ pressed }) => [styles.card, { backgroundColor: palette.surface, borderColor: palette.border }, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={[type.small, { color: palette.text, fontWeight: '600' }]}>{record.name}</Text>
          <Text style={[type.caption, { color: palette.textMuted }]}>
            {record.territory} · {record.period}
          </Text>
        </View>
        <Text style={[type.value, { color: palette.text }]}>{record.formattedValue}</Text>
      </View>
      <Text style={[type.caption, { color: palette.textMuted, marginTop: spacing.sm }]}>
        Source : {record.source}
        {record.verifiedAt ? ` · vérifié le ${dateFormat.format(new Date(record.verifiedAt))}` : ''}
      </Text>
      <View style={styles.links}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Ouvrir la page d'origine sur ${record.platform}`}
          onPress={() => void Linking.openURL(record.url)}
          hitSlop={6}
          style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}
        >
          <Feather name="external-link" size={13} color={palette.accent} />
          <Text style={[type.caption, { color: palette.accent }]}>Page d&apos;origine ({record.platform})</Text>
        </Pressable>
        <View style={styles.link}>
          <Feather name="chevron-right" size={13} color={palette.textMuted} />
          <Text style={[type.caption, { color: palette.textMuted }]}>Fiche et séries</Text>
        </View>
      </View>
      <Text style={[type.caption, styles.mono, { color: palette.textMuted }]}>{record.indicatorId}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headText: { flex: 1, gap: 2 },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, marginTop: spacing.xs },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 28 },
  mono: { fontFamily: 'monospace', marginTop: spacing.xs },
});
