import React, { useState } from 'react';
import { Cpu, Brain, Sparkles, X, ChevronDown, ListTodo, Check } from 'lucide-react';
import { ModelId, ReasoningEffort } from '../lib/types';

interface ModelControlsProps {
  selectedModel: ModelId;
  onSelectModel: (model: ModelId) => void;
  reasoningEffort: ReasoningEffort;
  onSelectReasoningEffort: (effort: ReasoningEffort) => void;
  isPlanMode: boolean;
  onTogglePlanMode: () => void;
}

export const ModelControls: React.FC<ModelControlsProps> = ({
  selectedModel,
  onSelectModel,
  reasoningEffort,
  onSelectReasoningEffort,
  isPlanMode,
  onTogglePlanMode,
}) => {
  const [openSheet, setOpenSheet] = useState<'model' | 'reasoning' | null>(null);

  const models: Array<{
    id: ModelId;
    title: string;
    subtitle: string;
    badge: string;
  }> = [
    {
      id: 'z-ai/glm-5.3',
      title: 'GLM-5.3',
      subtitle: 'Raciocínio analítico avançado e raciocínio profundo',
      badge: 'Pensar',
    },
    {
      id: 'z-ai/glm-5.3-flash',
      title: 'GLM-5.3 Flash',
      subtitle: 'Mais rápido + Suporte multimodal a visão e fotos',
      badge: 'Visão',
    },
  ];

  const reasoningLevels: Array<{
    id: ReasoningEffort;
    title: string;
    subtitle: string;
    level: string;
  }> = [
    {
      id: 'low',
      title: 'Thinking: low',
      subtitle: 'Menor latência para respostas rápidas e concisas',
      level: '1x',
    },
    {
      id: 'high',
      title: 'Thinking: high',
      subtitle: 'Análise detalhada e reflexão passo a passo',
      level: '2x',
    },
    {
      id: 'max',
      title: 'Thinking: max',
      subtitle: 'Raciocínio estendido exaustivo para problemas complexos',
      level: '3x',
    },
  ];

  return (
    <>
      {/* ================= CLAUDE.AI BOTTOM PILL TOOLBAR ================= */}
      <div className="flex items-center justify-between gap-1.5 mt-2 px-1 text-xs select-none">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {/* Model Selector Pill (Claude style) */}
          <button
            type="button"
            onClick={() => setOpenSheet('model')}
            aria-label="Selecionar modelo"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors text-xs font-medium cursor-pointer ${
              openSheet === 'model'
                ? 'bg-[#33302a] text-[#f3efe6] border border-[#4a463d]'
                : 'bg-[#22201d] hover:bg-[#2c2925] border border-[#36332d] text-[#b8b3a8]'
            }`}
          >
            <span className="font-medium text-[#f3efe6]">
              {selectedModel === 'z-ai/glm-5.3' ? 'GLM-5.3' : 'GLM Flash'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#8c867a]" />
          </button>

          {/* Reasoning / Extended Thinking Pill */}
          <button
            type="button"
            onClick={() => setOpenSheet('reasoning')}
            aria-label="Ajustar pensamento estendido"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors text-xs font-medium cursor-pointer ${
              openSheet === 'reasoning'
                ? 'bg-[#33302a] text-[#f3efe6] border border-[#4a463d]'
                : 'bg-[#22201d] hover:bg-[#2c2925] border border-[#36332d] text-[#b8b3a8]'
            }`}
          >
            <Brain className="w-3.5 h-3.5 text-[#d97757]" />
            <span className="text-[#8c867a] text-[11px]">pensar:</span>
            <span className="text-[#f3efe6] font-medium">{reasoningEffort}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#8c867a]" />
          </button>

          {/* Plan Mode Pill */}
          <button
            type="button"
            onClick={onTogglePlanMode}
            aria-label="Alternar Modo Plano"
            title="Ativar/Desativar modo de planejamento estruturado"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors text-xs font-medium cursor-pointer ${
              isPlanMode
                ? 'bg-[#d97757]/20 text-[#f09a7d] border border-[#d97757]/40'
                : 'bg-[#22201d] hover:bg-[#2c2925] border border-[#36332d] text-[#8c867a]'
            }`}
          >
            <ListTodo className={`w-3.5 h-3.5 ${isPlanMode ? 'text-[#d97757]' : 'text-[#8c867a]'}`} />
            <span className={isPlanMode ? 'text-[#f3efe6]' : ''}>Plano</span>
            <span
              className={`text-[9px] px-1 py-0.2 rounded font-mono uppercase font-bold ${
                isPlanMode ? 'bg-[#d97757] text-white' : 'bg-[#2f2d28] text-[#8c867a]'
              }`}
            >
              {isPlanMode ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>

        <span className="text-[10px] text-[#6b675e] font-mono hidden sm:inline select-none">
          NVIDIA NIM
        </span>
      </div>

      {/* ================= CLAUDE.AI BOTTOM SHEET / MODAL ================= */}
      {openSheet && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-in fade-in duration-150">
          {/* Dimmed warm backdrop */}
          <div
            onClick={() => setOpenSheet(null)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity cursor-pointer"
          />

          {/* Claude Warm Card */}
          <div className="relative w-full max-w-md mx-auto bg-[#23211d] border border-[#3b3831] rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 shadow-2xl z-10 animate-in slide-in-from-bottom duration-150 pb-6 sm:pb-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#312f2a]">
              <div>
                <h3 className="text-sm font-semibold text-[#f3efe6] tracking-tight">
                  {openSheet === 'model' ? 'Modelo' : 'Pensamento Estendido (Reasoning)'}
                </h3>
                <p className="text-xs text-[#9c9588] mt-0.5">
                  {openSheet === 'model'
                    ? 'Selecione o modelo do Synap'
                    : 'Nível de raciocínio da IA antes de responder'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenSheet(null)}
                aria-label="Fechar"
                className="p-1 rounded-lg text-[#8c867a] hover:text-[#f3efe6] hover:bg-[#302d27] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            {openSheet === 'model' ? (
              <div className="space-y-1.5">
                {models.map((item) => {
                  const isSelected = selectedModel === item.id;

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        onSelectModel(item.id);
                        setOpenSheet(null);
                      }}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#2e2b26] text-[#f3efe6] border border-[#d97757]/40 shadow-xs'
                          : 'bg-[#1e1c19] hover:bg-[#282622] border border-[#312f2a] text-[#b8b3a8]'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-[#f3efe6]">{item.title}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                              isSelected
                                ? 'bg-[#d97757]/20 text-[#f09a7d]'
                                : 'bg-[#2b2925] text-[#8c867a]'
                            }`}
                          >
                            {item.badge}
                          </span>
                        </div>
                        <p className="text-xs text-[#9c9588] mt-0.5 leading-snug">
                          {item.subtitle}
                        </p>
                      </div>

                      {isSelected && (
                        <Check className="w-4 h-4 text-[#d97757] flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-1.5">
                {reasoningLevels.map((item) => {
                  const isSelected = reasoningEffort === item.id;

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        onSelectReasoningEffort(item.id);
                        setOpenSheet(null);
                      }}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#2e2b26] text-[#f3efe6] border border-[#d97757]/40 shadow-xs'
                          : 'bg-[#1e1c19] hover:bg-[#282622] border border-[#312f2a] text-[#b8b3a8]'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-[#f3efe6]">{item.title}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium ${
                              isSelected
                                ? 'bg-[#d97757]/20 text-[#f09a7d]'
                                : 'bg-[#2b2925] text-[#8c867a]'
                            }`}
                          >
                            {item.level}
                          </span>
                        </div>
                        <p className="text-xs text-[#9c9588] mt-0.5 leading-snug">
                          {item.subtitle}
                        </p>
                      </div>

                      {isSelected && (
                        <Check className="w-4 h-4 text-[#d97757] flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
