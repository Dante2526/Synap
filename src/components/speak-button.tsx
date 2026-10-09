import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface SpeakButtonProps {
  text: string;
}

export const SpeakButton: React.FC<SpeakButtonProps> = ({ text }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setIsSupported(false);
      return;
    }

    const checkSpeaking = () => {
      if (window.speechSynthesis) {
        setIsSpeaking(window.speechSynthesis.speaking);
      }
    };

    const interval = setInterval(checkSpeaking, 250);
    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleToggleSpeak = () => {
    if (!window.speechSynthesis || !text.trim()) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    // Cancel any previous utterance
    window.speechSynthesis.cancel();

    // Strip code blocks and raw markdown syntax for smoother speech reading
    const cleanText = text
      .replace(/```[\s\S]*?```/g, 'Bloco de código omitido.')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*_#~[\]()]/g, ' ')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'pt-BR';

    // Find best pt-BR voice
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find((v) => v.lang.startsWith('pt') || v.lang.includes('BR'));
    if (ptVoice) {
      utterance.voice = ptVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (e) => {
      console.warn('Speech error:', e);
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  if (!isSupported) return null;

  return (
    <button
      onClick={handleToggleSpeak}
      aria-label={isSpeaking ? 'Parar leitura em voz alta' : 'Ouvir resposta em voz alta'}
      title={isSpeaking ? 'Parar leitura em voz alta' : 'Ouvir resposta (pt-BR)'}
      className={`p-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 ${
        isSpeaking
          ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
      }`}
    >
      {isSpeaking ? (
        <>
          <VolumeX className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-[11px] text-purple-300">Parar voz</span>
        </>
      ) : (
        <>
          <Volume2 className="w-3.5 h-3.5" />
          <span className="text-[11px]">Ouvir</span>
        </>
      )}
    </button>
  );
};
