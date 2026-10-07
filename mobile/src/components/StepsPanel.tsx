import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing, type, useTheme } from '../theme';
import type { AskStep } from '../types';

const KIND_LABEL: Record<AskStep['kind'], string> = {
  language: 'Langue',
  translate: 'Traduction',
  fallback: 'Modèle',
  cache: 'Cache',
  search: 'Recherche',
  fetch: 'Base',
  surveys: 'ANADS',
  no_data: 'Absence',
  compose: 'Rédaction',
  guard: 'Garde',
};

/**
 * Étapes réelles du traitement envoyées par le serveur : en direct pendant l'attente,
 * repliées en « n étapes » une fois la réponse arrivée.
 */
export function StepsPanel({ steps, live }: { steps: AskStep[]; live: boolean }) {
  const { palette } = useTheme();
  const [open, setOpen] = useState(false);

  if (!steps.length) {
    return live ? (
      <View style={styles.liveRow} accessibilityLiveRegion="polite">
        <ActivityIndicator color={palette.textMuted} />
        <Text style={[type.small, { color: palette.textMuted }]}>Connexion au service…</Text>
      </View>
    ) : null;
  }

  const first = new Date(steps[0].at).getTime();
  const list = (
    <View style={styles.list}>
      {steps.map((s, i) => {
        const dt = Math.max(0, new Date(s.at).getTime() - first) / 1000;
        const current = live && i === steps.length - 1;
        return (
          <View key={`${s.at}-${i}`} style={styles.row}>
            <Text style={[type.caption, styles.kind, { color: palette.textMuted }]}>{KIND_LABEL[s.kind]}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[type.caption, { color: current ? palette.text : palette.textMuted }]}>{s.label}</Text>
              {s.detail ? (
                <Text numberOfLines={1} style={[type.caption, { color: palette.textMuted, fontSize: 11 }]}>
                  {s.detail}
                </Text>
              ) : null}
            </View>
            <Text style={[type.caption, { color: palette.textMuted, fontVariant: ['tabular-nums'] }]}>{dt.toFixed(1)} s</Text>
          </View>
        );
      })}
    </View>
  );

  if (live) {
    return (
      <View accessibilityLiveRegion="polite">
        <View style={styles.liveRow}>
          <ActivityIndicator color={palette.accent} />
          <Text style={[type.small, { color: palette.text, flex: 1 }]}>{steps[steps.length - 1].label}</Text>
        </View>
        {list}
      </View>
    );
  }

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        hitSlop={6}
        style={styles.toggle}
      >
        <Text style={[type.caption, { color: palette.textMuted }]}>
          {open ? '▾' : '▸'} {steps.length} étape{steps.length > 1 ? 's' : ''} de traitement
        </Text>
      </Pressable>
      {open && list}
    </View>
  );
}

const styles = StyleSheet.create({
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 28 },
  list: { marginTop: spacing.xs, gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  kind: { width: 64 },
  toggle: { minHeight: 32, justifyContent: 'center' },
});
