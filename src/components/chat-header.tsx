import React from 'react';
import { PanelLeft, Plus, AlertCircle, Settings, FolderGit2, GitBranch, X, RefreshCw, Terminal as TerminalIcon, ChevronDown } from 'lucide-react';
import { ClaudeLogo } from './claude-logo';
import { ActiveRepoState } from '../lib/types';

interface ChatHeaderProps {
  onToggleSidebar: () => void;
  onNewChat: () => void;
  hasApiKey: boolean | null;
  onOpenSettings?: () => void;
  activeRepo?: ActiveRepoState | null;
  pendingChangesCount?: number;
  onOpenSourceControl?: () => void;
  onOpenRepoList?: () => void;
  onCloseRepo?: () => void;
  onToggleTerminal?: () => void;
  isTerminalOpen?: boolean;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  onToggleSidebar,
  onNewChat,
  hasApiKey,
  onOpenSettings,
  activeRepo,
  pendingChangesCount = 0,
  onOpenSourceControl,
  onOpenRepoList,
  onCloseRepo,
  onToggleTerminal,
  isTerminalOpen = false,
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

      {/* Center: Synap Branding or Active Repo Indicator */}
      <div className="flex items-center gap-2 max-w-[50%] min-w-0">
        {activeRepo ? (
          <div className="flex items-center gap-1.5 p-1 px-2.5 rounded-xl bg-[#23211d] border border-[#3e3b33] text-xs font-mono min-w-0 shadow-xs">
            <button
              type="button"
              onClick={onOpenSourceControl}
              title={`Repositório exclusivo deste chat: ${activeRepo.fullName} (${activeRepo.branch}). Clique para abrir Source Control.`}
              className="flex items-center gap-1.5 text-[#f3efe6] hover:text-[#d97757] transition truncate cursor-pointer"
            >
              <FolderGit2 className="w-3.5 h-3.5 text-[#d97757] shrink-0" />
              <span className="truncate max-w-[120px] sm:max-w-[190px] font-medium">
                {activeRepo.fullName}
              </span>
              <span className="text-[#8c867a]">·</span>
              <span className="text-[#c4bfb6] truncate max-w-[70px]">{activeRepo.branch}</span>
            </button>

            {pendingChangesCount > 0 && (
              <button
                type="button"
                onClick={onOpenSourceControl}
                title={`${pendingChangesCount} alteração(ões) pendente(s) no Source Control`}
                className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#d97757]/20 text-[#f09a7d] border border-[#d97757]/40 hover:bg-[#d97757]/30 transition cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#d97757] animate-pulse" />
                <span>●{pendingChangesCount}</span>
              </button>
            )}

            {onOpenRepoList && (
              <button
                type="button"
                onClick={onOpenRepoList}
                title="Trocar repositório deste chat"
                className="p-1 rounded text-[#8c867a] hover:text-[#f3efe6] hover:bg-[#322f28] transition cursor-pointer ml-0.5"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}

            {onCloseRepo && (
              <button
                type="button"
                onClick={onCloseRepo}
                title="Desconectar repositório deste chat"
                className="p-1 rounded text-[#8c867a] hover:text-rose-400 hover:bg-[#322f28] transition cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2">
              <ClaudeLogo className="w-5 h-5 text-[#d97757]" />
              <span className="font-serif text-base sm:text-lg text-[#f3efe6] tracking-tight font-normal">
                Synap
              </span>
            </div>
            {onOpenRepoList && (
              <button
                type="button"
                onClick={onOpenRepoList}
                title="Conectar um repositório GitHub exclusivamente a este chat"
                className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[#24221d] hover:bg-[#2e2a23] text-[#8c867a] hover:text-[#f3efe6] border border-[#38342c] text-[11px] font-sans transition cursor-pointer"
              >
                <FolderGit2 className="w-3 h-3 text-[#d97757]" />
                <span>Vincular Repo</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right side: Terminal button & Settings */}
      <div className="flex items-center gap-2">
        {hasApiKey === false && (
          <div
            title="Chave de API não configurada no servidor (.env.local)"
            className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 flex-shrink-0"
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Sem Chave</span>
          </div>
        )}

        {onToggleTerminal && (
          <button
            type="button"
            onClick={onToggleTerminal}
            aria-label="Alternar Terminal"
            title="Abrir/Fechar Terminal (Ctrl+`)"
            className={`flex items-center gap-1.5 px-2.5 py-1 sm:py-1.5 rounded-lg border text-xs font-mono transition-colors duration-150 cursor-pointer select-none ${
              isTerminalOpen
                ? 'bg-[#d97757]/20 text-[#f09a7d] border-[#d97757]/40 shadow-xs'
                : 'bg-[#25231f] hover:bg-[#2e2a24] text-[#c4bfb6] hover:text-[#f3efe6] border-[#36332d]'
            }`}
          >
            <TerminalIcon className="w-3.5 h-3.5 text-[#d97757]" />
            <span className="font-medium">Terminal</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-[#8c867a] transition-transform duration-200 ${
                isTerminalOpen ? 'rotate-180 text-[#d97757]' : ''
              }`}
            />
          </button>
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
