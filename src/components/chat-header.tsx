import React from 'react';
import { PanelLeft, Plus, AlertCircle, Settings } from 'lucide-react';
import { ClaudeLogo } from './claude-logo';

interface ChatHeaderProps {
  onToggleSidebar: () => void;
  onNewChat: () => void;
  hasApiKey: boolean | null;
  onOpenSettings?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  onToggleSidebar,
  onNewChat,
  hasApiKey,
  onOpenSettings,
}) => {
  return (
    <header className="h-13 sm:h-14 border-b border-[#2d2b26] bg-[#1b1a17]/90 backdrop-blur-md px-3 sm:px-5 flex items-center justify-between sticky top-0 z-30 select-none max-w-full overflow-hidden">
      {/* Left side: Claude sidebar toggle & New chat */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Alternar barra lateral"
          className="p-1.5 rounded-lg text-[#a39d93] hover:text-[#f3efe6] hover:bg-[#282622] transition-colors md:hidden cursor-pointer"
        >
          <PanelLeft className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={onNewChat}
          aria-label="Nova conversa"
          title="Nova conversa"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[#c2bcb0] hover:text-[#f3efe6] hover:bg-[#282622] text-xs sm:text-sm font-medium transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#d97757]" />
          <span className="hidden sm:inline">Nova conversa</span>
        </button>
      </div>

      {/* Center: Claude Asterisk Logo & Synap Branding */}
      <div className="flex items-center gap-2">
        <ClaudeLogo className="w-5 h-5 text-[#d97757]" />
        <span className="font-serif text-base sm:text-lg text-[#f3efe6] tracking-tight font-normal">
          Synap
        </span>
      </div>

      {/* Right side: Status indicator & Settings */}
      <div className="flex items-center gap-2">
        {hasApiKey === false ? (
          <div
            title="Chave de API não configurada no servidor (.env.local)"
            className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 flex-shrink-0"
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Sem Chave</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#a39d93] px-2.5 py-1 rounded-md bg-[#25231f] border border-[#36332d]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Online</span>
          </div>
        )}

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Configurações"
            className="p-1.5 rounded-lg text-[#a39d93] hover:text-[#f3efe6] hover:bg-[#282622] transition-colors cursor-pointer hidden sm:block"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
