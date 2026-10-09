import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Loader2 } from 'lucide-react';
import { cleanTextForSpeech, getBestPortugueseVoice } from '../lib/speech';

interface SpeakButtonProps {
  text: string;
}

export const SpeakButton: React.FC<SpeakButtonProps> = ({ text }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup audio on unmount
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsLoading(false);
  };

  const handleToggleSpeak = async () => {
    if (isPlaying || isLoading) {
      stopAudio();
      return;
    }

    if (!text.trim()) return;

    // Check if we already have the audio blob cached for this message
    if (audioUrlRef.current) {
      try {
        const audio = new Audio(audioUrlRef.current);
        audioRef.current = audio;
        audio.onended = () => setIsPlaying(false);
        audio.onerror = () => setIsPlaying(false);
        setIsPlaying(true);
        await audio.play();
        return;
      } catch (err) {
        console.warn('Cached audio playback failed, generating new:', err);
      }
    }

    setIsLoading(true);

    try {
      // 1. Try high-fidelity Neural TTS from backend (/api/tts)
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: 'pt-BR-FranciscaNeural', // Best natural Portuguese neural voice
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;

        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => setIsPlaying(false);
        audio.onerror = () => setIsPlaying(false);

        setIsLoading(false);
        setIsPlaying(true);
        await audio.play();
        return;
      }
    } catch (err) {
      console.warn('Neural TTS endpoint unavailable, falling back to browser speech:', err);
    }

    // 2. Fallback to Web Speech API if endpoint is offline or fails
    setIsLoading(false);
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const clean = cleanTextForSpeech(text);
      if (!clean) return;

      const utterance = new SpeechSynthesisUtterance(clean);
      const best = getBestPortugueseVoice();
      if (best) utterance.voice = best;
      utterance.lang = 'pt-BR';
      utterance.rate = 1.06;
      utterance.pitch = 1.0;

      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);

      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <button
      onClick={handleToggleSpeak}
      disabled={isLoading && !isPlaying}
      aria-label={isPlaying ? 'Parar leitura em voz alta' : 'Ouvir resposta com voz natural humana'}
      title={
        isPlaying
          ? 'Parar leitura em voz alta'
          : 'Ouvir com voz neural natural (Francisca - pt-BR)'
      }
      className={`px-2 py-1 rounded-lg text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
        isPlaying
          ? 'bg-[#d97757]/20 text-[#f09a7d] border border-[#d97757]/40'
          : isLoading
          ? 'bg-[#282622] text-[#d97757] border border-[#3d3a33]'
          : 'text-[#8c867a] hover:text-[#f3efe6] hover:bg-[#282622]'
      }`}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#d97757]" />
          <span className="text-[11px] font-medium text-[#f09a7d]">Carregando voz...</span>
        </>
      ) : isPlaying ? (
        <>
          <span className="flex items-center gap-0.5 h-3">
            <span className="w-0.5 h-2 bg-[#d97757] animate-pulse" style={{ animationDelay: '0ms' }} />
            <span className="w-0.5 h-3 bg-[#f09a7d] animate-pulse" style={{ animationDelay: '150ms' }} />
            <span className="w-0.5 h-1.5 bg-[#d97757] animate-pulse" style={{ animationDelay: '300ms' }} />
          </span>
          <VolumeX className="w-3.5 h-3.5 text-[#d97757]" />
          <span className="text-[11px] font-medium text-[#f09a7d]">Parar</span>
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
