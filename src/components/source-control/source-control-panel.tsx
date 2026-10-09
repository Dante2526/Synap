import React, { useState } from 'react';
import {
  GitCommit,
  GitBranch,
  FolderGit2,
  Plus,
  Minus,
  Undo2,
  Check,
  AlertCircle,
  ExternalLink,
  Loader2,
  Trash2,
  Eye,
} from 'lucide-react';
import { PendingChange, ActiveRepoState } from '../../lib/types';
import { usePendingChanges } from '../../lib/pending-changes';
import { commitStagedChanges } from '../../lib/github-commit';
import { DiffViewer } from './diff-viewer';

interface SourceControlPanelProps {
  activeRepo: ActiveRepoState | null;
  onOpenRepoList: () => void;
  onOpenSettings: () => void;
  onSelectChangeToView?: (change: PendingChange) => void;
}

export const SourceControlPanel: React.FC<SourceControlPanelProps> = ({
  activeRepo,
  onOpenRepoList,
  onOpenSettings,
}) => {
  const {
    changes,
    stageChange,
    unstageChange,
    discardChange,
    discardAll,
    stageAll,
    unstageAll,
    clearCommitted,
    updateChangeContent,
  } = usePendingChanges();

  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitSuccess, setCommitSuccess] = useState<{ sha: string; url: string } | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [confirmDiscardAll, setConfirmDiscardAll] = useState(false);
  const [selectedChange, setSelectedChange] = useState<PendingChange | null>(null);

  // Filter changes for current active repo
  const repoChanges = activeRepo
    ? changes.filter(
        (c) => c.repo === activeRepo.fullName && c.branch === activeRepo.branch
      )
    : [];

  const unstagedChanges = repoChanges.filter((c) => !c.staged);
  const stagedChanges = repoChanges.filter((c) => c.staged);

  const handleCommit = async () => {
    if (!activeRepo) return;
    if (!commitMessage.trim()) {
      setCommitError('Digite uma mensagem para o commit.');
      return;
    }

    // If nothing staged, stage all changes automatically for convenient single-click commit
    const changesToCommit = stagedChanges.length > 0 ? stagedChanges : repoChanges;
    if (changesToCommit.length === 0) {
      setCommitError('Nenhuma alteração para commitar.');
      return;
    }

    setIsCommitting(true);
    setCommitError(null);
    setCommitSuccess(null);

    try {
      const result = await commitStagedChanges(
        null,
        activeRepo.owner,
        activeRepo.repo,
        activeRepo.branch,
        commitMessage.trim(),
        changesToCommit
      );

      await clearCommitted(changesToCommit);
      setCommitMessage('');
      setCommitSuccess({
        sha: result.sha.substring(0, 7),
        url: result.html_url,
      });
    } catch (err: any) {
      console.error('Commit error:', err);
      let msg = err?.message || 'Falha ao realizar commit no GitHub.';
      if (err?.status === 403 || err?.status === 401) {
        msg = 'Permissão negada (403/401). Verifique se o seu token tem permissão "Contents: Read and write" ou se a branch é protegida.';
      }
      setCommitError(msg);
    } finally {
      setIsCommitting(false);
    }
  };

  const handleDiscardAll = async () => {
    if (!activeRepo) return;
    await discardAll(activeRepo.fullName, activeRepo.branch);
    setConfirmDiscardAll(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#181714] text-[#f3efe6] select-none overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-[#2d2a25] bg-[#1d1b18] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-[#d97757]" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#c4bfb6]">
            Source Control
          </h2>
        </div>
        {activeRepo && repoChanges.length > 0 && (
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#d97757]/20 text-[#f09a7d] border border-[#d97757]/40">
            {repoChanges.length} pendente(s)
          </span>
        )}
      </div>

      {/* Active Repo Selector or Empty State */}
      {!activeRepo ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
          <FolderGit2 className="w-10 h-10 text-[#544f45]" />
          <div>
            <h3 className="text-sm font-medium text-[#f3efe6]">Nenhum repositório neste chat</h3>
            <p className="text-xs text-[#8c867a] mt-1 max-w-xs">
              Vincule um repositório GitHub a esta conversa para usar o Source Control e permitir edições pela IA.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenRepoList}
            className="px-3.5 py-1.5 rounded-lg bg-[#d97757] hover:bg-[#c26647] text-white text-xs font-medium transition cursor-pointer shadow-xs"
          >
            Vincular Repositório a este Chat
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-y-auto">
          {/* Active Repo Info Card */}
          <div className="p-3 bg-[#201e1a] border-b border-[#2d2a25] flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-medium text-[#f3efe6] truncate">
                <FolderGit2 className="w-3.5 h-3.5 text-[#d97757] shrink-0" />
                <span className="truncate">{activeRepo.fullName}</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-mono text-[#8c867a] mt-0.5">
                <GitBranch className="w-3 h-3 text-[#d97757]" />
                <span>{activeRepo.branch}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenRepoList}
              className="text-[11px] text-[#d97757] hover:underline shrink-0 ml-2 cursor-pointer"
            >
              Trocar
            </button>
          </div>

          {/* Commit Message Box */}
          <div className="p-3 border-b border-[#2d2a25] space-y-2 bg-[#1b1a17]">
            <div className="relative">
              <textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Mensagem de commit (Cmd/Ctrl + Enter para enviar)"
                rows={2}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleCommit();
                  }
                }}
                disabled={isCommitting || repoChanges.length === 0}
                className="w-full p-2.5 rounded-xl bg-[#131210] border border-[#3b3831] text-xs text-[#f3efe6] placeholder-[#6b665c] focus:outline-hidden focus:border-[#d97757] resize-none disabled:opacity-50"
              />
            </div>

            {/* Commit and Discard All buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCommit}
                disabled={isCommitting || repoChanges.length === 0 || !commitMessage.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#d97757] hover:bg-[#c26647] text-white text-xs font-medium transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              >
                {isCommitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Commitando...</span>
                  </>
                ) : (
                  <>
                    <GitCommit className="w-3.5 h-3.5" />
                    <span>
                      Commit {stagedChanges.length > 0 ? `(${stagedChanges.length})` : `(${repoChanges.length})`}
                    </span>
                  </>
                )}
              </button>

              {repoChanges.length > 0 && (
                <>
                  {!confirmDiscardAll ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDiscardAll(true)}
                      title="Descartar todas as alterações pendentes"
                      className="p-1.5 rounded-lg text-[#a39d93] hover:text-rose-400 hover:bg-[#282622] transition cursor-pointer border border-[#3b3831]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 bg-[#3a1d1d] border border-rose-800 rounded-lg px-2 py-1">
                      <span className="text-[10px] text-rose-300">Descartar tudo?</span>
                      <button
                        onClick={handleDiscardAll}
                        aria-label="Confirmar descarte total"
                        className="p-0.5 text-rose-400 hover:text-white cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setConfirmDiscardAll(false)}
                        aria-label="Cancelar"
                        className="p-0.5 text-zinc-400 hover:text-white cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Success notification */}
            {commitSuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-800/40 text-xs text-emerald-300 flex items-start justify-between gap-2 animate-in fade-in">
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    Commit <span className="font-mono">{commitSuccess.sha}</span> criado com sucesso!
                  </span>
                </div>
                <a
                  href={commitSuccess.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] text-emerald-400 hover:underline shrink-0"
                >
                  <span>Ver</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Error notice */}
            {commitError && (
              <div className="p-2.5 rounded-xl bg-rose-950/50 border border-rose-800/40 text-xs text-rose-300 flex items-start gap-1.5 animate-in fade-in">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-tight">{commitError}</span>
              </div>
            )}
          </div>

          {/* Staged Changes Section */}
          {stagedChanges.length > 0 && (
            <div className="border-b border-[#2d2a25]">
              <div className="px-3 py-1.5 bg-[#1f1d19] flex items-center justify-between text-[11px] font-mono font-medium text-[#b8b3a8]">
                <span>STAGED CHANGES ({stagedChanges.length})</span>
                <button
                  type="button"
                  onClick={() => unstageAll(activeRepo.fullName, activeRepo.branch)}
                  title="Unstage all"
                  className="p-0.5 hover:text-white text-[#8c867a] cursor-pointer"
                >
                  <Minus className="w-3 h-3" />
                </button>
              </div>
              <div className="divide-y divide-[#262420]">
                {stagedChanges.map((change) => (
                  <ChangeRow
                    key={change.id}
                    change={change}
                    onViewDiff={() => setSelectedChange(change)}
                    onToggleStage={() => unstageChange(change.id)}
                    onDiscard={() => discardChange(change.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Unstaged Changes Section */}
          <div>
            <div className="px-3 py-1.5 bg-[#1f1d19] flex items-center justify-between text-[11px] font-mono font-medium text-[#b8b3a8]">
              <span>CHANGES ({unstagedChanges.length})</span>
              {unstagedChanges.length > 0 && (
                <button
                  type="button"
                  onClick={() => stageAll(activeRepo.fullName, activeRepo.branch)}
                  title="Stage all"
                  className="p-0.5 hover:text-white text-[#8c867a] cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>

            {unstagedChanges.length === 0 && stagedChanges.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#8c867a]">
                <p>Nenhuma mudança pendente.</p>
                <p className="mt-1 text-[11px] text-[#6b665c]">
                  Peça à IA para editar ou criar arquivos no chat — as alterações aparecerão aqui para revisão.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#262420]">
                {unstagedChanges.map((change) => (
                  <ChangeRow
                    key={change.id}
                    change={change}
                    onViewDiff={() => setSelectedChange(change)}
                    onToggleStage={() => stageChange(change.id)}
                    onDiscard={() => discardChange(change.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Diff Viewer Modal */}
      {selectedChange && (
        <DiffViewer
          change={selectedChange}
          isOpen={true}
          onClose={() => setSelectedChange(null)}
          onStage={stageChange}
          onUnstage={unstageChange}
          onDiscard={discardChange}
          onUpdateContent={updateChangeContent}
        />
      )}
    </div>
  );
};

interface ChangeRowProps {
  change: PendingChange;
  onViewDiff: () => void;
  onToggleStage: () => void;
  onDiscard: () => void;
}

const ChangeRow: React.FC<ChangeRowProps> = ({
  change,
  onViewDiff,
  onToggleStage,
  onDiscard,
}) => {
  return (
    <div
      onClick={onViewDiff}
      className="group px-3 py-2 flex items-center justify-between text-xs hover:bg-[#25231f] transition cursor-pointer"
    >
      <div className="flex items-center gap-2 min-w-0 pr-2">
        {/* Status letter M / A / D */}
        <span
          className={`font-mono font-bold text-[11px] shrink-0 w-3.5 text-center ${
            change.type === 'modified'
              ? 'text-amber-400'
              : change.type === 'added'
              ? 'text-emerald-400'
              : 'text-rose-400'
          }`}
        >
          {change.type === 'modified' ? 'M' : change.type === 'added' ? 'A' : 'D'}
        </span>

        {/* Path */}
        <span className="font-mono text-xs text-[#f3efe6] truncate group-hover:text-white">
          {change.path}
        </span>
      </div>

      {/* Action buttons [+] / [-] */}
      <div
        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onViewDiff}
          title="Ver Diff"
          className="p-1 rounded text-[#a39d93] hover:text-[#f3efe6] hover:bg-[#322f28] transition cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onDiscard}
          title="Descartar alteração"
          className="p-1 rounded text-[#a39d93] hover:text-rose-400 hover:bg-[#322f28] transition cursor-pointer"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onToggleStage}
          title={change.staged ? 'Unstage' : 'Stage'}
          className="p-1 rounded text-[#a39d93] hover:text-emerald-400 hover:bg-[#322f28] transition cursor-pointer"
        >
          {change.staged ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
