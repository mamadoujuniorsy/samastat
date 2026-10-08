import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { fetchCatalogue, fetchHealth } from '../api';
import { Composer } from '../components/Composer';
import { EmptyState } from '../components/EmptyState';
import { HistorySheet } from '../components/HistorySheet';
import { IndicatorSheet } from '../components/IndicatorSheet';
import { MessageBubble } from '../components/MessageBubble';
import { SettingsSheet } from '../components/SettingsSheet';
import { TopBar } from '../components/TopBar';
import { useConversations } from '../hooks/useConversations';
import { useSpeaker } from '../hooks/useSpeaker';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { defaultSettings, loadSettings, saveSettings, type Settings } from '../storage';
import { spacing, type, useTheme } from '../theme';
import type { IndicatorSummary, Message } from '../types';

const ATTRIBUTION =
  "Adapté à partir des informations de l'ANSD, sous licence conformément à l'Accord de licence de données ouvertes de l'ANSD.";

export function ChatScreen() {
  const { palette, isDark } = useTheme();
  const conv = useConversations();
  const speaker = useSpeaker();
  const [draft, setDraft] = useState('');
  const [draftVoiceLanguage, setDraftVoiceLanguage] = useState<'fr' | 'wo' | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [indicatorId, setIndicatorId] = useState<string | null>(null);
  const [catalogue, setCatalogue] = useState<IndicatorSummary[] | null>(null);
  const [health, setHealth] = useState<{ indicators: number; surveys: number } | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    let cancelled = false;
    loadSettings().then((s) => !cancelled && setSettings(s));
    fetchCatalogue().then((c) => !cancelled && setCatalogue(c));
    fetchHealth().then((h) => !cancelled && setHealth(h));
    return () => {
      cancelled = true;
    };
  }, []);

  // À chaque réponse : retour haptique léger, et lecture automatique si l'option est active.
  useEffect(() => {
    conv.onAnswer((r) => {
      void Haptics.notificationAsync(
        r.status === 'error' ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success,
      ).catch(() => undefined);
      if (settings.autoRead && r.status !== 'error') {
        const lang = r.meta.language === 'wo' ? 'wo' : 'fr';
        const text = lang === 'wo' && r.answerWolof ? r.answerWolof : r.answer;
        speaker.speak(`auto-${r.meta.retrievedAt}`, text, lang);
      }
    });
  }, [conv, settings.autoRead, speaker]);

  const send = useCallback(
    (text: string, language?: 'fr' | 'wo') => {
      speaker.stop();
      setDraft('');
      setDraftVoiceLanguage(null);
      void conv.send(text, language);
    },
    [conv, speaker],
  );

  const voice = useVoiceInput({
    language: settings.voiceLanguage,
    onFinal: (text, language) => {
      if (settings.autoSendAfterDictation) send(text, language);
      else {
        setDraft(text.slice(0, 500));
        setDraftVoiceLanguage(language);
      }
    },
  });

  const toggleAutoRead = () => {
    const next = { ...settings, autoRead: !settings.autoRead };
    setSettings(next);
    void saveSettings(next);
    if (!next.autoRead) speaker.stop();
  };

  const messages = conv.active?.messages ?? [];

  useEffect(() => {
    if (messages.length) {
      const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
      return () => clearTimeout(t);
    }
  }, [messages.length]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <TopBar
        title={conv.active ? conv.active.title : 'SamaStat'}
        autoRead={settings.autoRead}
        onToggleAutoRead={toggleAutoRead}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onNewConversation={() => {
          speaker.stop();
          setDraft('');
          setDraftVoiceLanguage(null);
          conv.newConversation();
        }}
      />

      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        {messages.length === 0 ? (
          <EmptyState catalogue={catalogue} health={health} onPick={send} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                pending={conv.pending && item.role === 'assistant' && !item.response && !item.transportError}
                speaking={speaker.speakingId === item.id}
                onToggleSpeak={speaker.toggle}
                onAsk={send}
                onRetry={conv.retry}
                onOpenIndicator={setIndicatorId}
              />
            )}
            ListFooterComponent={<Text style={[type.caption, styles.attribution, { color: palette.textMuted }]}>{ATTRIBUTION}</Text>}
          />
        )}

        <View style={[styles.composer, { borderTopColor: palette.border, backgroundColor: palette.bg }]}>
          <Composer value={draft} onChange={(text) => { setDraft(text); if (!text.trim()) setDraftVoiceLanguage(null); }}
            onSend={(text) => send(text, draftVoiceLanguage ?? undefined)} onStop={conv.stop} pending={conv.pending} voice={voice}
            autoSendAfterDictation={settings.autoSendAfterDictation} />
        </View>
      </KeyboardAvoidingView>

      <HistorySheet
        visible={historyOpen}
        conversations={conv.conversations}
        activeId={conv.active?.id ?? null}
        onSelect={(id) => {
          speaker.stop();
          conv.selectConversation(id);
        }}
        onDelete={conv.deleteConversation}
        onClose={() => setHistoryOpen(false)}
      />

      <SettingsSheet
        visible={settingsOpen}
        settings={settings}
        health={health}
        voiceAvailable={voice.available}
        onChange={(next) => {
          setSettings(next);
          void saveSettings(next);
          if (!next.autoRead) speaker.stop();
        }}
        onClose={() => setSettingsOpen(false)}
      />

      <IndicatorSheet indicatorId={indicatorId} onClose={() => setIndicatorId(null)} onAsk={(q) => { setDraft(q); setDraftVoiceLanguage(null); }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { paddingBottom: spacing.xl },
  attribution: { paddingHorizontal: spacing.lg, marginTop: spacing.xxl },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.sm },
});
