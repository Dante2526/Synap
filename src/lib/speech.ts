/**
 * Sistema de Síntese de Voz (TTS) Neural de Alta Fidelidade
 * Utiliza o modelo neural Gemini 3.8 Flash Lite TTS com fallback automático para Web Speech API.
 */

let currentAudio: HTMLAudioElement | null = null;
let currentOnEndCallback: (() => void) | null = null;

export const NEURAL_VOICES = [
  { id: 'Kore', name: 'Kore (Feminina Suave - Natural)', gender: 'feminino' },
  { id: 'Zephyr', name: 'Zephyr (Feminina Expressiva)', gender: 'feminino' },
  { id: 'Puck', name: 'Puck (Jovem e Amigável)', gender: 'neutro' },
  { id: 'Fenrir', name: 'Fenrir (Masculina Encorpada)', gender: 'masculino' },
  { id: 'Charon', name: 'Charon (Masculina Madura)', gender: 'masculino' },
] as const;

export function cleanTextForSpeech(rawText: string): string {
  return rawText
    // Remove tags de raciocínio / thinking
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    // Remove blocos de código
    .replace(/```[\s\S]*?```/g, ' Trecho de código omitido. ')
    // Código inline
    .replace(/`([^`]+)`/g, '$1')
    // Remove links markdown e preserva texto do link
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove cabeçalhos markdown
    .replace(/^#{1,6}\s+/gm, '')
    // Remove tabelas markdown
    .replace(/\|[^\n]+\|/g, '')
    // Remove listas com marcadores (*, -, 1.)
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // Remove símbolos de negrito e itálico
    .replace(/[*_~]{1,3}/g, '')
    // Substitui quebras repetidas por ponto para pausas naturais
    .replace(/\n+/g, '. ')
    // Remove pontuações estranhas
    .replace(/[-=]{3,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stopCurrentSpeech() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  if (currentOnEndCallback) {
    currentOnEndCallback();
    currentOnEndCallback = null;
  }
}

/**
 * Toca áudio com voz neural de estúdio
 */
export async function playNeuralSpeech(
  text: string,
  voice: string = 'Kore',
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: any) => void
): Promise<boolean> {
  stopCurrentSpeech();

  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) return false;

  currentOnEndCallback = onEnd || null;

  try {
    // 1. Tenta usar o serviço neural de estúdio do servidor
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: cleaned,
        voice: voice || 'Kore',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.audio) {
        const audio = new Audio(`data:audio/wav;base64,${data.audio}`);
        currentAudio = audio;

        audio.onplay = () => {
          if (onStart) onStart();
        };

        audio.onended = () => {
          currentAudio = null;
          if (onEnd) onEnd();
        };

        audio.onerror = (e) => {
          console.warn('Audio element error:', e);
          currentAudio = null;
          // Fallback para fala do navegador se o player falhar
          fallbackToBrowserSpeech(cleaned, onStart, onEnd, onError);
        };

        await audio.play();
        return true;
      }
    }

    // Se o endpoint não estiver disponível, faz fallback
    fallbackToBrowserSpeech(cleaned, onStart, onEnd, onError);
    return false;
  } catch (error) {
    console.warn('Neural TTS indisponível, usando fallback local:', error);
    fallbackToBrowserSpeech(cleaned, onStart, onEnd, onError);
    return false;
  }
}

export function getBestPortugueseVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const ptVoice = voices.find(
    (v) =>
      (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Google')) &&
      v.lang.startsWith('pt')
  ) || voices.find((v) => v.lang.startsWith('pt'));
  return ptVoice || null;
}

function fallbackToBrowserSpeech(
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: any) => void
) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    if (onEnd) onEnd();
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pt-BR';
  utterance.rate = 1.05;
  utterance.pitch = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const ptVoice = voices.find(
    (v) =>
      (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Google')) &&
      v.lang.startsWith('pt')
  ) || voices.find((v) => v.lang.startsWith('pt'));

  if (ptVoice) utterance.voice = ptVoice;

  utterance.onstart = () => {
    if (onStart) onStart();
  };

  utterance.onend = () => {
    if (onEnd) onEnd();
  };

  utterance.onerror = (e) => {
    if (e.error !== 'interrupted' && e.error !== 'canceled') {
      if (onError) onError(e);
    }
    if (onEnd) onEnd();
  };

  window.speechSynthesis.speak(utterance);
}
