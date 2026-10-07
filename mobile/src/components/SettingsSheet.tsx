import { Linking, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL } from '../api';
import type { Settings } from '../storage';
import { radius, spacing, TOUCH, type, useTheme } from '../theme';
import { IconButton } from './TopBar';

interface Props {
  visible: boolean;
  settings: Settings;
  health: { indicators: number; surveys: number } | null;
  voiceAvailable: boolean;
  onChange: (next: Settings) => void;
  onClose: () => void;
}

/** Réglages et informations : lecture automatique, dictée, état du service, sources et licence. */
export function SettingsSheet({ visible, settings, health, voiceAvailable, onChange, onClose }: Props) {
  const { palette } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]} edges={['top', 'bottom']}>
        <View style={[styles.head, { borderBottomColor: palette.border }]}>
          <Text style={[type.title, { color: palette.text, flex: 1 }]}>Réglages</Text>
          <IconButton label="Fermer" icon="x" onPress={onClose} color={palette.text} />
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <Group title="Voix">
            <Row
              label="Lire chaque réponse à voix haute"
              hint="Français sur le téléphone ; wolof via la voix du serveur si disponible."
              value={settings.autoRead}
              onChange={(v) => onChange({ ...settings, autoRead: v })}
            />
            <Row
              label="Envoyer dès la fin de la dictée"
              hint={voiceAvailable ? 'Le vocal transcrit (wolof ou français) part tout seul.' : 'Dictée indisponible.'}
              value={settings.autoSendAfterDictation}
              onChange={(v) => onChange({ ...settings, autoSendAfterDictation: v })}
            />
            <Text style={[type.small, { color: palette.text }]}>Langue de dictée</Text>
            <View style={styles.langs}>
              {(
                [
                  ['auto', 'Auto'],
                  ['fr', 'Français'],
                  ['wo', 'Wolof'],
                ] as const
              ).map(([id, label]) => (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: settings.voiceLanguage === id }}
                  onPress={() => onChange({ ...settings, voiceLanguage: id })}
                  style={[
                    styles.lang,
                    {
                      borderColor: settings.voiceLanguage === id ? palette.accent : palette.border,
                      backgroundColor: settings.voiceLanguage === id ? palette.accent : palette.surfaceMuted,
                    },
                  ]}
                >
                  <Text
                    style={[
                      type.caption,
                      { color: settings.voiceLanguage === id ? palette.onAccent : palette.text },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Group>

          <Group title="Service">
            <Line label="API" value={API_URL} mono />
            <Line
              label="Catalogue"
              value={health ? `${health.indicators} indicateurs, ${health.surveys} enquêtes ANADS` : 'injoignable'}
            />
            <Line label="Modèle de langage" value="appel d’outils ; n’écrit jamais un chiffre" />
          </Group>

          <Group title="Données">
            <Text style={[type.small, { color: palette.text }]}>
              Valeurs relues sur les publications de l’ANSD (RGPH-5 2023, EHCVM II, ENES, IHPC, comptes nationaux) et
              catalogue ANADS. Licence Creative Commons Attribution 4.0, conformément à l’Accord de licence de données
              ouvertes de l’ANSD.
            </Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => void Linking.openURL('https://www.ansd.sn')}
              style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}
            >
              <Text style={[type.small, { color: palette.accent, textDecorationLine: 'underline' }]}>ansd.sn</Text>
            </Pressable>
          </Group>

          <Group title="Vie privée">
            <Text style={[type.small, { color: palette.text }]}>
              Les conversations restent sur cet appareil. Seule la question est transmise à l’API et conservée sans
              identifiant, pour le tableau de bord d’usage de l’ANSD.
            </Text>
          </Group>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const { palette } = useTheme();
  return (
    <View style={[styles.group, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Text style={[type.caption, { color: palette.textMuted, marginBottom: spacing.xs }]}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const { palette } = useTheme();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={[type.small, { color: palette.text }]}>{label}</Text>
        {hint ? <Text style={[type.caption, { color: palette.textMuted }]}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: palette.accent }} />
    </View>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: { padding: spacing.lg, gap: spacing.md },
  group: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH },
  langs: { flexDirection: 'row', gap: spacing.sm },
  lang: {
    minHeight: TOUCH,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
  },
  link: { minHeight: 32, justifyContent: 'center' },
});
