import { describe, expect, it } from 'vitest';
import {
  groqTranscriptionKey,
  isAcceptedAudioMime,
  parseVoiceLanguage,
  resolveTranscriptLanguage,
  safeAudioFilename,
  whisperLanguageFields,
} from './transcription.service.js';

describe('transcription audio', () => {
  it('accepte les formats web, téléphone et vocaux WhatsApp', () => {
    expect(isAcceptedAudioMime('audio/webm;codecs=opus')).toBe(true);
    expect(isAcceptedAudioMime('audio/ogg; codecs=opus')).toBe(true);
    expect(isAcceptedAudioMime('audio/mp4')).toBe(true);
    expect(isAcceptedAudioMime('audio/amr')).toBe(true);
    expect(isAcceptedAudioMime('video/mp4')).toBe(false);
  });

  it('choisit une extension sûre pour Groq', () => {
    expect(safeAudioFilename('a/../x.ogg', 'audio/ogg; codecs=opus')).toBe('axogg.ogg');
    expect(safeAudioFilename('question.webm', 'audio/webm')).toBe('questionwebm.webm');
    expect(safeAudioFilename('', 'audio/ogg')).toBe('question.ogg');
  });

  it('ne force pas de code langue Whisper pour le wolof (non supporté)', () => {
    expect(whisperLanguageFields('wo').language).toBeUndefined();
    expect(whisperLanguageFields('wo').prompt.toLowerCase()).toContain('wolof');
    expect(whisperLanguageFields('fr').language).toBe('fr');
    expect(whisperLanguageFields('auto').language).toBeUndefined();
  });

  it('interprète la langue demandée', () => {
    expect(parseVoiceLanguage('wo')).toBe('wo');
    expect(parseVoiceLanguage('fr')).toBe('fr');
    expect(parseVoiceLanguage(undefined)).toBe('auto');
    expect(parseVoiceLanguage('es')).toBe('auto');
  });

  it('prend GROQ_API_KEY même si le repli LLM n’est pas Groq', () => {
    expect(groqTranscriptionKey((k) => (k === 'GROQ_API_KEY' ? 'g' : k === 'SAMASTAT_FALLBACK_PROVIDER' ? 'openai' : undefined))).toBe('g');
    expect(groqTranscriptionKey((k) => (k === 'SAMASTAT_FALLBACK_PROVIDER' ? 'openai' : undefined))).toBeUndefined();
    expect(groqTranscriptionKey((k) => (k === 'SAMASTAT_FALLBACK_API_KEY' ? 'fb' : undefined))).toBe('fb');
  });

  it('résout la langue d’un vocal sans forcer le français', () => {
    expect(resolveTranscriptLanguage('wo', 'bonjour')).toBe('wo');
    expect(resolveTranscriptLanguage('auto', 'Ñaata nit ñoo dëkk Dakar ?')).toBe('wo');
    expect(resolveTranscriptLanguage('auto', 'xyz', 'wo')).toBe('wo');
    expect(resolveTranscriptLanguage('auto', 'Quelle est la population de Dakar ?')).toBe('fr');
  });
});
