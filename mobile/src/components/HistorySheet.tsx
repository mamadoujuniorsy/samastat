import { Feather } from '@expo/vector-icons';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, TOUCH, type, useTheme } from '../theme';
import type { Conversation } from '../types';
import { IconButton } from './TopBar';

interface Props {
  visible: boolean;
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

/** Liste des conversations enregistrées sur l'appareil. */
export function HistorySheet({ visible, conversations, activeId, onSelect, onDelete, onClose }: Props) {
  const { palette } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]} edges={['top', 'bottom']}>
        <View style={[styles.head, { borderBottomColor: palette.border }]}>
          <Text style={[type.title, { color: palette.text, flex: 1 }]}>Conversations</Text>
          <IconButton label="Fermer" icon="x" onPress={onClose} color={palette.text} />
        </View>
        {conversations.length === 0 ? (
          <Text style={[type.body, { color: palette.textMuted, padding: spacing.lg }]}>
            Aucune conversation enregistrée. Elles restent sur cet appareil uniquement.
          </Text>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(c) => c.id}
            ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: palette.border }} />}
            renderItem={({ item }) => (
              <View style={[styles.row, item.id === activeId && { backgroundColor: palette.accentSoft }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Ouvrir la conversation ${item.title}`}
                  onPress={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                  style={styles.rowMain}
                >
                  <Text numberOfLines={1} style={[type.body, { color: palette.text }]}>
                    {item.title}
                  </Text>
                  <Text style={[type.caption, { color: palette.textMuted }]}>
                    {dateFormat.format(new Date(item.updatedAt))} · {Math.ceil(item.messages.length / 2)} question
                    {item.messages.length > 2 ? 's' : ''}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Supprimer la conversation ${item.title}`}
                  onPress={() => onDelete(item.id)}
                  hitSlop={6}
                  style={styles.delete}
                >
                  <Feather name="trash-2" size={18} color={palette.textMuted} />
                </Pressable>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
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
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.lg, paddingRight: spacing.sm },
  rowMain: { flex: 1, paddingVertical: spacing.md, gap: 2, minHeight: TOUCH, justifyContent: 'center' },
  delete: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
});
