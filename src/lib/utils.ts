import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  // If today
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  // If yesterday
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Ontem';
  }

  // Otherwise dd/mm/yyyy
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function generateTitleFromMessage(content: string): string {
  const clean = content.trim().replace(/^#+\s*/, '').replace(/\n+/g, ' ');
  if (!clean) return 'Nova conversa';
  if (clean.length <= 32) return clean;
  return clean.slice(0, 32) + '...';
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // Validate image type
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Apenas arquivos de imagem são permitidos.'));
    }
    // Limit to 5MB
    if (file.size > 5 * 1024 * 1024) {
      return reject(new Error('A imagem não pode ultrapassar 5MB.'));
    }

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}
