import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { transcribeAudio } from '../api';
import type { Settings } from '../storage';

const MAX_RECORDING_MS = 30_000;

export interface VoiceInput {
  available: boolean;
  listening: boolean;
  transcribing: boolean;
  transcript: string;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  cancel: () => void;
}

interface Options {
  language: Settings['voiceLanguage'];
  /** Appelé avec le texte définitif quand l’enregistrement est transcrit. */
  onFinal?: (text: string, language: 'fr' | 'wo') => void;
}

/**
 * Enregistre un court vocal, l’envoie à l’API (Whisper) et récupère le texte
 * en français ou en wolof. Fonctionne aussi dans Expo Go (contrairement à la
 * reconnaissance vocale native, limitée au français).
 */
export function useVoiceInput({ language, onFinal }: Options): VoiceInput {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFinalRef = useRef(onFinal);
  const languageRef = useRef(language);
  onFinalRef.current = onFinal;
  languageRef.current = language;

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void recorder.stop().catch(() => undefined);
    },
    [recorder],
  );

  const finish = useCallback(
    async (submit: boolean) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      try {
        await recorder.stop();
      } catch {
        // déjà arrêté
      }
      setListening(false);
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      if (!submit || cancelledRef.current) {
        setTranscript('');
        return;
      }
      const uri = recorder.uri;
      if (!uri) {
        setError('L’enregistrement est vide. Réessayez.');
        return;
      }
      setTranscribing(true);
      setError(null);
      try {
        const result = await transcribeAudio(uri, languageRef.current);
        setTranscript(result.text);
        onFinalRef.current?.(result.text, result.language);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'La transcription a échoué.');
      } finally {
        setTranscribing(false);
      }
    },
    [recorder],
  );

  const start = useCallback(async () => {
    if (listening || transcribing) return;
    setError(null);
    setTranscript('');
    cancelledRef.current = false;
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setError('Autorisez le microphone dans les réglages du téléphone.');
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, interruptionMode: 'duckOthers' });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setListening(true);
      timerRef.current = setTimeout(() => {
        void finish(true);
      }, MAX_RECORDING_MS);
    } catch {
      setError("Le micro n'a pas pu être utilisé.");
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    }
  }, [finish, listening, recorder, transcribing]);

  const stop = useCallback(() => {
    if (!listening) return;
    void finish(true);
  }, [finish, listening]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setTranscript('');
    void finish(false);
  }, [finish]);

  return { available: true, listening, transcribing, transcript, error, start, stop, cancel };
}
