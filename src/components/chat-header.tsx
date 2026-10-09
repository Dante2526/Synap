import React from 'react';
import { Menu, Plus, Sparkles, Brain, Cpu, ShieldCheck, AlertCircle } from 'lucide-react';
import { ModelId, ReasoningEffort } from '../lib/types';

interface ChatHeaderProps {
  onToggleSidebar: () => void;
  onNewChat: () => void;
  selectedModel: ModelId;
  onSelectModel: (model: ModelId) => void;
  reasoningEffort: ReasoningEffort;
  onSelectReasoningEffort: (effort: ReasoningEffort) => void;
  hasApiKey: boolean | null;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  onToggleSidebar,
  onNewChat,
  selectedModel,
  onSelectModel,
  reasoningEffort,
  onSelectReasoningEffort,
  hasApiKey,
}) => {
  return (
    <header className="h-14 sm:h-16 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Left side: hamburger (mobile) & title */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Alternar barra lateral"
          className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors md:hidden cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={onNewChat}
          aria-label="Nova conversa"
          title="Nova conversa"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800/60 hover:border-zinc-700 text-xs sm:text-sm font-medium transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 text-purple-400" />
          <span className="hidden sm:inline">Nova conversa</span>
        </button>
      </div>

      {/* Center / Right Controls: Model & Reasoning Effort */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Model Selector */}
        <div className="relative flex items-center">
          <label htmlFor="model-select" className="sr-only">
            Selecione o Modelo
          </label>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/90 hover:border-purple-500/40 text-xs sm:text-sm text-zinc-200 transition-colors">
            <Cpu className="w-3.5 h-3.5 text-purple-400 hidden sm:block" />
            <select
              id="model-select"
              value={selectedModel}
              onChange={(e) => onSelectModel(e.target.value as ModelId)}
              className="bg-transparent text-zinc-100 text-xs sm:text-sm font-medium focus:outline-none cursor-pointer pr-1"
            >
              <option value="z-ai/glm-5.3" className="bg-zinc-900 text-zinc-100">
                GLM-5.3 (Pensar)
              </option>
              <option value="z-ai/glm-5.3-flash" className="bg-zinc-900 text-zinc-100">
                GLM-5.3-Flash (Rápido + Visão)
              </option>
            </select>
          </div>
        </div>

        {/* Reasoning Effort Selector */}
        <div className="relative flex items-center">
          <label htmlFor="reasoning-select" className="sr-only">
            Nível de Raciocínio (reasoning_effort)
          </label>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/90 hover:border-purple-500/40 text-xs sm:text-sm text-zinc-200 transition-colors" title="reasoning_effort enviado no nível raiz da API NVIDIA">
            <Brain className="w-3.5 h-3.5 text-indigo-400 hidden sm:block" />
            <span className="text-zinc-500 text-xs hidden lg:inline font-mono">esforço:</span>
            <select
              id="reasoning-select"
              value={reasoningEffort}
              onChange={(e) => onSelectReasoningEffort(e.target.value as ReasoningEffort)}
              className="bg-transparent text-zinc-100 text-xs sm:text-sm font-medium focus:outline-none cursor-pointer"
            >
              <option value="low" className="bg-zinc-900 text-zinc-100">
                low (rápido)
              </option>
              <option value="high" className="bg-zinc-900 text-zinc-100">
                high (profundo)
              </option>
              <option value="max" className="bg-zinc-900 text-zinc-100">
                max (máximo)
              </option>
            </select>
          </div>
        </div>

        {/* API key status indicator badge */}
        {hasApiKey === false && (
          <div
            title="Chave de API da NVIDIA não configurada no servidor (.env.local)"
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300"
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Sem Key</span>
          </div>
        )}
      </div>
    </header>
  );
};
