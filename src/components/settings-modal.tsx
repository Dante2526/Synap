import React, { useState } from 'react';
import { X, Moon, Sun, Volume2, Database, Trash2, Download, KeyRound, AlertTriangle } from 'lucide-react';
import { AppSettings, Conversation } from '../lib/types';
import { exportConversationsToJSON } from '../lib/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  conversations: Conversation[];
  onClearHistory: () => Promise<void>;
  hasApiKey: boolean | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  conversations,
  onClearHistory,
  hasApiKey,
}) => {
  const [confirmStep, setConfirmStep] = useState<0 | 1 | 2>(0);
  const [isClearing, setIsClearing] = useState(false);

  if (!isOpen) return null;

  const handleClear = async () => {
    setIsClearing(true);
    await onClearHistory();
    setIsClearing(false);
    setConfirmStep(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-white">Configurações</h2>
          <button
            onClick={() => {
              setConfirmStep(0);
              onClose();
            }}
            aria-label="Fechar configurações"
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {/* API Key Status Notice */}
          <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/60 text-xs">
            <div className="flex items-center gap-2 mb-1.5 font-medium text-zinc-200">
              <KeyRound className="w-4 h-4 text-purple-400" />
              <span>Conexão com a NVIDIA NIM</span>
            </div>
            <p className="text-zinc-400 leading-relaxed">
              {hasApiKey
                ? 'Chave de API configurada no servidor com sucesso.'
                : 'Para conversar, defina a chave no arquivo .env.local do servidor.'}
            </p>
          </div>

          {/* Toggles */}
          <div className="space-y-4">
            {/* Save history */}
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <Database className="w-4 h-4 text-purple-400" />
                <div>
                  <div className="text-sm font-medium text-zinc-200">Salvar histórico localmente</div>
                  <div className="text-xs text-zinc-500">Persistir conversas no IndexedDB do navegador</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.saveHistoryLocally}
                onChange={(e) => onUpdateSettings({ saveHistoryLocally: e.target.checked })}
                className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
              />
            </label>

            {/* Voice enabled */}
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <Volume2 className="w-4 h-4 text-purple-400" />
                <div>
                  <div className="text-sm font-medium text-zinc-200">Voz habilitada</div>
                  <div className="text-xs text-zinc-500">Habilitar microfone e leitura em voz alta (Web Speech API)</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.voiceEnabled}
                onChange={(e) => onUpdateSettings({ voiceEnabled: e.target.checked })}
                className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
              />
            </label>

            {/* Dark mode */}
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                {settings.darkMode ? (
                  <Moon className="w-4 h-4 text-purple-400" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-400" />
                )}
                <div>
                  <div className="text-sm font-medium text-zinc-200">Modo escuro</div>
                  <div className="text-xs text-zinc-500">Tema escuro com detalhes em roxo</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.darkMode}
                onChange={(e) => onUpdateSettings({ darkMode: e.target.checked })}
                className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
              />
            </label>
          </div>

          <div className="border-t border-zinc-800/80 pt-4 space-y-3">
            {/* Export JSON */}
            <button
              type="button"
              onClick={() => exportConversationsToJSON(conversations)}
              disabled={conversations.length === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-800/40 text-zinc-200 hover:bg-zinc-800 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Download className="w-4 h-4 text-purple-400" />
              <span>Exportar conversas (JSON)</span>
            </button>

            {/* Clear History with double confirmation */}
            {confirmStep === 0 && (
              <button
                type="button"
                onClick={() => setConfirmStep(1)}
                disabled={conversations.length === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-900/30 bg-rose-950/20 text-rose-300 hover:bg-rose-950/40 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Limpar todo o histórico</span>
              </button>
            )}

            {confirmStep === 1 && (
              <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-950/20 text-xs space-y-2">
                <div className="flex items-center gap-1.5 text-amber-300 font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Confirmação 1 de 2</span>
                </div>
                <p className="text-zinc-300">Tem certeza que deseja apagar todas as conversas salvas?</p>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setConfirmStep(2)}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs transition"
                  >
                    Sim, continuar
                  </button>
                  <button
                    onClick={() => setConfirmStep(0)}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs transition"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {confirmStep === 2 && (
              <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-950/40 text-xs space-y-2">
                <div className="flex items-center gap-1.5 text-rose-300 font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Confirmação final (Ação irreversível)</span>
                </div>
                <p className="text-zinc-300">
                  Todas as {conversations.length} conversas serão deletadas permanentemente do seu navegador.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleClear}
                    disabled={isClearing}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition disabled:opacity-50"
                  >
                    {isClearing ? 'Apagando...' : 'Apagar tudo definitivamente'}
                  </button>
                  <button
                    onClick={() => setConfirmStep(0)}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs transition"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-950/40 text-[11px] text-zinc-500 text-center">
          Synap AI • NVIDIA NIM • Modelos GLM-5.3 & GLM-5.3-Flash
        </div>
      </div>
    </div>
  );
};
