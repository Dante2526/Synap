import React, { useState } from 'react';
import { X, Moon, Sun, Volume2, Database, Trash2, Download, KeyRound, AlertTriangle, Check, Sparkles } from 'lucide-react';
import { AppSettings, Conversation } from '../lib/types';
import { exportConversationsToJSON } from '../lib/storage';
import { NEURAL_VOICES } from '../lib/speech';
import { ClaudeLogo } from './claude-logo';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  conversations: Conversation[];
  onClearHistory: () => Promise<void>;
  hasApiKey: boolean | null;
  hasGeminiKey?: boolean | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  conversations,
  onClearHistory,
  hasApiKey,
  hasGeminiKey,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      {/* Claude Warm Card Sheet */}
      <div className="w-full max-w-md rounded-2xl bg-[#23211d] border border-[#3b3831] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#312f2a]">
          <div className="flex items-center gap-2.5">
            <ClaudeLogo className="w-5 h-5 text-[#d97757]" />
            <div>
              <h2 className="text-sm font-semibold text-[#f3efe6] tracking-tight">Configurações</h2>
              <p className="text-[11px] text-[#8c867a]">Synap • Claude Design System</p>
            </div>
          </div>
          <button
            onClick={() => {
              setConfirmStep(0);
              onClose();
            }}
            aria-label="Fechar configurações"
            className="w-7 h-7 rounded-lg bg-[#2e2b26] hover:bg-[#38352f] text-[#a39d93] hover:text-[#f3efe6] transition-all flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* API Keys Status Notices */}
          <div className="space-y-2">
            {/* NVIDIA NIM Key Status */}
            <div className="p-3 rounded-xl border border-[#3b3831] bg-[#1d1b18] text-xs">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 font-medium text-[#f3efe6]">
                  <KeyRound className="w-3.5 h-3.5 text-[#d97757]" />
                  <span>NVIDIA NIM (Chat & Modelos GLM)</span>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                    hasApiKey
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {hasApiKey ? 'Conectado' : 'Não configurada'}
                </span>
              </div>
              <p className="text-[#a39d93] leading-relaxed text-[11px]">
                {hasApiKey
                  ? 'NVIDIA_API_KEY ativa para os modelos GLM-5.3 e GLM-5.3-Flash.'
                  : 'Adicione NVIDIA_API_KEY no arquivo .env.local para conversar com os modelos.'}
              </p>
            </div>

            {/* Edge TTS Status */}
            <div className="p-3 rounded-xl border border-[#3b3831] bg-[#1d1b18] text-xs">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 font-medium text-[#f3efe6]">
                  <Sparkles className="w-3.5 h-3.5 text-[#d97757]" />
                  <span>Microsoft Edge TTS (Vozes Neurais pt-BR)</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Ativo (Sem Chave / Grátis)
                </span>
              </div>
              <p className="text-[#a39d93] leading-relaxed text-[11px]">
                As vozes neurais da Microsoft em português do Brasil (Francisca, Antonio e Thalita) estão ativadas no servidor sem precisar de nenhuma chave de API.
                {hasGeminiKey && ' GEMINI_API_KEY também detectada caso queira alternar para as vozes Aoede ou Puck.'}
              </p>
            </div>
          </div>

          {/* Grouped Settings Card - Claude Style */}
          <div className="rounded-xl bg-[#1d1b18] border border-[#312f2a] p-4 space-y-4">
            {/* Save history */}
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#2b2722] flex items-center justify-center text-[#d97757]">
                  <Database className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-medium text-[#f3efe6]">Salvar histórico localmente</div>
                  <div className="text-[10px] text-[#8c867a]">Persistir conversas no IndexedDB do navegador</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.saveHistoryLocally}
                onChange={(e) => onUpdateSettings({ saveHistoryLocally: e.target.checked })}
                className="w-4 h-4 accent-[#d97757] rounded cursor-pointer"
              />
            </label>

            {/* Voice enabled */}
            <label className="flex items-center justify-between cursor-pointer border-t border-[#2d2a25] pt-3.5">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#2b2722] flex items-center justify-center text-[#d97757]">
                  <Volume2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-medium text-[#f3efe6]">Voz neural humana</div>
                  <div className="text-[10px] text-[#8c867a]">Leitura em voz alta com sintetizador neural</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.voiceEnabled}
                onChange={(e) => onUpdateSettings({ voiceEnabled: e.target.checked })}
                className="w-4 h-4 accent-[#d97757] rounded cursor-pointer"
              />
            </label>

            {/* Voice Persona Selector */}
            {settings.voiceEnabled && (
              <div className="pl-10 pt-1 pb-1 space-y-2 border-t border-[#2d2a25]/60">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-[#a39d93] font-medium">
                    Voz da Leitura (Português do Brasil):
                  </label>
                  <span className="text-[10px] text-[#736e65]">Dicção natural</span>
                </div>
                <div className="space-y-1.5">
                  {NEURAL_VOICES.map((voice) => {
                    const currentSelected = settings.speechVoice || 'pt-BR-FranciscaNeural';
                    const isSelected = currentSelected === voice.id;
                    return (
                      <button
                        key={voice.id}
                        type="button"
                        onClick={() => onUpdateSettings({ speechVoice: voice.id })}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                          isSelected
                            ? 'bg-[#2f2b25] border border-[#d97757]/40 text-[#f3efe6] font-medium'
                            : 'bg-[#181614] border border-[#2b2924] text-[#a39d93] hover:bg-[#25221d]'
                        }`}
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span>{voice.name}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                                isSelected
                                  ? 'bg-[#d97757]/20 text-[#f09a7d]'
                                  : 'bg-[#22201c] text-[#736e65]'
                              }`}
                            >
                              {voice.tag}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#736e65] leading-tight">{voice.description}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#d97757] shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dark mode */}
            <label className="flex items-center justify-between cursor-pointer border-t border-[#2d2a25] pt-3.5">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#2b2722] flex items-center justify-center text-[#d97757]">
                  {settings.darkMode ? (
                    <Moon className="w-3.5 h-3.5 text-[#d97757]" />
                  ) : (
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                  )}
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-medium text-[#f3efe6]">Tema Escuro Claude</div>
                  <div className="text-[10px] text-[#8c867a]">Paleta carvão & terracota acolhedora</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.darkMode}
                onChange={(e) => onUpdateSettings({ darkMode: e.target.checked })}
                className="w-4 h-4 accent-[#d97757] rounded cursor-pointer"
              />
            </label>
          </div>

          {/* Action buttons */}
          <div className="pt-2 space-y-2">
            {/* Export JSON */}
            <button
              type="button"
              onClick={() => exportConversationsToJSON(conversations)}
              disabled={conversations.length === 0}
              className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-[#3b3831] bg-[#1d1b18] text-[#c4bfb6] hover:bg-[#282621] hover:text-[#f3efe6] active:scale-[0.99] text-xs sm:text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#d97757]" />
              <span>Exportar conversas (JSON)</span>
            </button>

            {/* Clear History with double confirmation */}
            {confirmStep === 0 && (
              <button
                type="button"
                onClick={() => setConfirmStep(1)}
                disabled={conversations.length === 0}
                className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-rose-900/30 bg-[#2b1917]/40 text-rose-300 hover:bg-[#381c19]/60 active:scale-[0.99] text-xs sm:text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Limpar todo o histórico</span>
              </button>
            )}

            {confirmStep === 1 && (
              <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-950/20 text-xs space-y-2">
                <div className="flex items-center gap-1.5 text-amber-300 font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Confirmação 1 de 2</span>
                </div>
                <p className="text-[#c4bfb6]">Tem certeza que deseja apagar todas as conversas salvas?</p>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setConfirmStep(2)}
                    className="flex-1 py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs transition cursor-pointer"
                  >
                    Sim, continuar
                  </button>
                  <button
                    onClick={() => setConfirmStep(0)}
                    className="flex-1 py-2 px-3 rounded-lg bg-[#282621] text-[#c4bfb6] hover:bg-[#312f2a] text-xs transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {confirmStep === 2 && (
              <div className="p-3.5 rounded-xl border border-rose-500/40 bg-rose-950/40 text-xs space-y-2">
                <div className="flex items-center gap-1.5 text-rose-300 font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Confirmação final (Ação irreversível)</span>
                </div>
                <p className="text-[#c4bfb6]">
                  Todas as {conversations.length} conversas serão deletadas permanentemente.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleClear}
                    disabled={isClearing}
                    className="flex-1 py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition disabled:opacity-50 cursor-pointer"
                  >
                    {isClearing ? 'Apagando...' : 'Apagar tudo definitivamente'}
                  </button>
                  <button
                    onClick={() => setConfirmStep(0)}
                    className="flex-1 py-2 px-3 rounded-lg bg-[#282621] text-[#c4bfb6] hover:bg-[#312f2a] text-xs transition cursor-pointer"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#312f2a] bg-[#1b1a17] text-[10px] text-[#736e65] text-center">
          Synap • Claude Design System • NVIDIA NIM
        </div>
      </div>
    </div>
  );
};
