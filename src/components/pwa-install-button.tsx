import React, { useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../lib/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        aria-label="Instalar aplicativo PWA"
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600/30 transition text-xs font-medium cursor-pointer"
      >
        <Download className="w-4 h-4 text-purple-400" />
        <span>Instalar App no Celular/PC</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          aria-label="Instalar app no iOS"
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-zinc-800/80 text-zinc-300 border border-zinc-700 hover:bg-zinc-800 transition text-xs font-medium cursor-pointer"
        >
          <Smartphone className="w-4 h-4 text-purple-400" />
          <span>Instalar no iPhone / iPad</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl">
              <h3 className="text-base font-semibold text-white">Instalar no iPhone / iPad</h3>
              <p className="mt-3 text-sm text-zinc-300 leading-relaxed">
                1. Toque no botão <strong>Compartilhar</strong> (ícone de quadrado com seta para cima) na barra do Safari.<br /><br />
                2. Role para baixo e selecione <strong>Adicionar à Tela de Início</strong>.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-purple-600 py-2.5 text-sm font-medium text-white hover:bg-purple-500 transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
