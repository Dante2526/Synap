import React, { useRef } from 'react';
import { Paperclip, X } from 'lucide-react';
import { fileToBase64 } from '../lib/utils';

interface ImageAttachmentProps {
  isFlashModel: boolean;
  images: string[];
  onImagesChange: (images: string[]) => void;
  disabled?: boolean;
}

export const ImageAttachment: React.FC<ImageAttachmentProps> = ({
  isFlashModel,
  images,
  onImagesChange,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newImages: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const base64 = await fileToBase64(file);
        newImages.push(base64);
      } catch (err: any) {
        alert(err.message || 'Erro ao carregar imagem');
      }
    }

    if (newImages.length > 0) {
      onImagesChange([...images, ...newImages]);
    }

    // Reset input value to allow re-selecting the same file if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    const updated = images.filter((_, i) => i !== index);
    onImagesChange(updated);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={handleFileChange}
        disabled={!isFlashModel || disabled}
      />

      <div className="relative group inline-block">
        <button
          type="button"
          onClick={() => {
            if (isFlashModel && !disabled) {
              fileInputRef.current?.click();
            }
          }}
          disabled={!isFlashModel || disabled}
          aria-label={
            isFlashModel
              ? 'Anexar imagens'
              : 'O modelo atual não suporta imagens. Alterne para o GLM-5.3-Flash.'
          }
          className={`p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center ${
            !isFlashModel
              ? 'text-zinc-600 cursor-not-allowed opacity-50'
              : 'text-zinc-400 hover:text-purple-300 hover:bg-zinc-800/80 active:scale-95 cursor-pointer'
          }`}
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {!isFlashModel && (
          <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2 bg-zinc-900 text-zinc-300 text-xs rounded-lg shadow-xl border border-zinc-800 text-center opacity-0 group-hover:opacity-100 transition-opacity z-50">
            Modelo atual não suporta imagens. Alterne para o GLM-5.3-Flash no topo.
          </div>
        )}
      </div>
    </>
  );
};

export const ImagePreviews: React.FC<{
  images: string[];
  onRemove: (index: number) => void;
}> = ({ images, onRemove }) => {
  if (images.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-3 pt-3 pb-1 border-b border-zinc-800/60">
      {images.map((img, idx) => (
        <div key={idx} className="relative group rounded-lg overflow-hidden border border-zinc-700 bg-zinc-900 shadow-sm w-16 h-16 flex-shrink-0">
          <img src={img} alt={`Anexo ${idx + 1}`} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onRemove(idx)}
            aria-label="Remover imagem"
            className="absolute top-1 right-1 p-0.5 rounded-full bg-zinc-950/80 text-zinc-300 hover:text-white hover:bg-rose-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
