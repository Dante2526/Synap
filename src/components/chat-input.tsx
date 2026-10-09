import React, { useState, useRef, useEffect } from 'react';
import { Send, Square } from 'lucide-react';
import { ImageAttachment, ImagePreviews } from './image-attachment';
import { VoiceButton } from './voice-button';

interface ChatInputProps {
  onSendMessage: (content: string, images: string[]) => void;
  onStopGeneration: () => void;
  isLoading: boolean;
  isFlashModel: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onStopGeneration,
  isLoading,
  isFlashModel,
}) => {
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea up to 200px
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  }, [content]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLoading) return;

    if (!content.trim() && images.length === 0) return;

    onSendMessage(content.trim(), images);
    setContent('');
    setImages([]);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      // keep focus on desktop
      if (window.innerWidth >= 768) {
        textareaRef.current.focus();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleVoiceTranscript = (text: string) => {
    setContent((prev) => (prev ? `${prev} ${text}` : text));
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 pb-3 sm:pb-5">
      <div className="relative rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-2xl backdrop-blur-md transition-all focus-within:border-purple-500/50 focus-within:ring-2 focus-within:ring-purple-500/20">
        {/* Previews for attached images */}
        <ImagePreviews images={images} onRemove={(idx) => setImages(images.filter((_, i) => i !== idx))} />

        <div className="flex items-end gap-1.5 p-2 sm:p-2.5">
          {/* Paperclip attachment button */}
          <ImageAttachment
            isFlashModel={isFlashModel}
            images={images}
            onImagesChange={setImages}
            disabled={isLoading}
          />

          {/* Voice recording button */}
          <VoiceButton
            onTranscript={handleVoiceTranscript}
            disabled={isLoading}
          />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isFlashModel
                ? 'Envie uma mensagem ou anexe imagens...'
                : 'Envie uma mensagem para o GLM-5.3...'
            }
            className="flex-1 max-h-[200px] py-2 px-2 text-sm sm:text-base text-zinc-100 placeholder-zinc-500 bg-transparent resize-none border-0 focus:outline-none focus:ring-0 leading-relaxed font-sans"
          />

          {/* Send / Stop button */}
          {isLoading ? (
            <button
              type="button"
              onClick={onStopGeneration}
              aria-label="Parar geração"
              title="Parar geração"
              className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/30 transition-all active:scale-95 flex items-center justify-center cursor-pointer"
            >
              <Square className="w-4 h-4 fill-white" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={!content.trim() && images.length === 0}
              aria-label="Enviar mensagem"
              title="Enviar mensagem (Enter)"
              className={`p-2.5 rounded-xl transition-all flex items-center justify-center ${
                content.trim() || images.length > 0
                  ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/30 active:scale-95 cursor-pointer'
                  : 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-center text-zinc-500 mt-2 select-none">
        Synap • NVIDIA NIM • GLM-5.3 • Shift + Enter para quebrar linha
      </p>
    </div>
  );
};
