import { useCallback, useEffect, useRef, useState } from 'react';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import { wolofTtsUrl } from '../api';

/** Lecture à voix haute : synthèse du téléphone en français, voix wolof du serveur sinon. */
export function useSpeaker() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const mounted = useRef(true);
  const playerRef = useRef<AudioPlayer | null>(null);

  const releasePlayer = useCallback(() => {
    const player = playerRef.current;
    playerRef.current = null;
    if (!player) return;
    try {
      player.pause();
      player.remove();
    } catch {
      // lecteur déjà libéré
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void Speech.stop();
      releasePlayer();
    };
  }, [releasePlayer]);

  const stop = useCallback(() => {
    void Speech.stop();
    releasePlayer();
    setSpeakingId(null);
  }, [releasePlayer]);

  const speakFrench = useCallback((id: string, text: string) => {
    const clear = () => {
      if (mounted.current) setSpeakingId((cur) => (cur === id ? null : cur));
    };
    Speech.speak(text.slice(0, Speech.maxSpeechInputLength), {
      language: 'fr-FR',
      rate: 0.95,
      onDone: clear,
      onStopped: clear,
      onError: clear,
    });
  }, []);

  const speak = useCallback(
    (id: string, text: string, language: 'fr' | 'wo' = 'fr') => {
      void Speech.stop();
      releasePlayer();
      setSpeakingId(id);
      if (language !== 'wo') {
        speakFrench(id, text);
        return;
      }
      const player = createAudioPlayer(wolofTtsUrl(text));
      playerRef.current = player;
      const sub = player.addListener('playbackStatusUpdate', (status) => {
        if (!status.didJustFinish && !status.playing && status.currentTime === 0 && speakingId === id) return;
        if (status.didJustFinish) {
          sub.remove();
          releasePlayer();
          if (mounted.current) setSpeakingId((cur) => (cur === id ? null : cur));
        }
      });
      try {
        player.play();
      } catch {
        sub.remove();
        releasePlayer();
        speakFrench(id, text);
      }
    },
    [releasePlayer, speakFrench, speakingId],
  );

  const toggle = useCallback(
    (id: string, text: string, language: 'fr' | 'wo' = 'fr') => {
      if (speakingId === id) stop();
      else speak(id, text, language);
    },
    [speak, speakingId, stop],
  );

  return { speakingId, speak, stop, toggle };
}
