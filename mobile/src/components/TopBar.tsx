import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing, TOUCH, useTheme } from '../theme';

interface Props {
  title: string;
  autoRead: boolean;
  onToggleAutoRead: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onNewConversation: () => void;
}

export function TopBar({ title, autoRead, onToggleAutoRead, onOpenHistory, onOpenSettings, onNewConversation }: Props) {
  const { palette } = useTheme();
  return (
    <View style={[styles.bar, { borderBottomColor: palette.border, backgroundColor: palette.bg }]}>
      <IconButton label="Historique des conversations" icon="clock" onPress={onOpenHistory} color={palette.text} />
      <Text numberOfLines={1} style={[styles.title, { color: palette.text }]}>
        {title}
      </Text>
      <IconButton
        label={autoRead ? 'Désactiver la lecture automatique des réponses' : 'Activer la lecture automatique des réponses'}
        icon={autoRead ? 'volume-2' : 'volume-x'}
        onPress={onToggleAutoRead}
        color={autoRead ? palette.accent : palette.textMuted}
        selected={autoRead}
      />
      <IconButton label="Réglages et informations" icon="settings" onPress={onOpenSettings} color={palette.text} />
      <IconButton label="Nouvelle conversation" icon="edit-3" onPress={onNewConversation} color={palette.text} />
    </View>
  );
}

export function IconButton({
  label,
  icon,
  onPress,
  color,
  selected,
  disabled,
  size = 22,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  color: string;
  selected?: boolean;
  disabled?: boolean;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: selected ?? false, disabled: disabled ?? false }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }, disabled && { opacity: 0.4 }]}
    >
      <Feather name={icon} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    height: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', marginHorizontal: spacing.sm },
  iconButton: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
});
