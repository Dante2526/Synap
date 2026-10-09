import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, ChevronRight, Copy, Check, FileText, ListTodo, FileCode, ExternalLink } from 'lucide-react';
import { Message } from '../lib/types';
import { formatFileSize } from '../lib/utils';
import { CodeBlock } from './code-block';
import { SpeakButton } from './speak-button';
import { ClaudeLogo } from './claude-logo';

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
  onViewDiff?: (path: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isStreaming = false,
  onViewDiff,
}) => {
  const isUser = message.role === 'user';
  const [showReasoning, setShowReasoning] = useState(false);
  const [copied, setCopied] = useState(false);

  // Extract reasoning if formatted with <think>...</think> tags or message.reasoning
  let thinkingContent = message.reasoning || '';
  let displayContent = message.content;

  if (!thinkingContent && displayContent.includes('<think>')) {
    const thinkMatch = displayContent.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
    if (thinkMatch) {
      thinkingContent = thinkMatch[1].trim();
      displayContent = displayContent.replace(/<think>[\s\S]*?(?:<\/think>|$)/, '').trim();
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <div className="py-4 px-3 sm:px-6 w-full max-w-3xl mx-auto">
      {isUser ? (
        /* ================= USER MESSAGE (Claude warm card on right) ================= */
        <div className="flex justify-end">
          <div className="bg-[#302e2a] text-[#f3efe6] border border-[#3e3b34] rounded-2xl px-4 py-2.5 max-w-[90%] sm:max-w-[80%] shadow-xs">
            {message.isPlanMode && (
              <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-[#3e3b34] text-[11px] font-mono font-medium text-[#f09a7d]">
                <ListTodo className="w-3.5 h-3.5 text-[#d97757]" />
                <span>Modo Plano Ativado</span>
              </div>
            )}

            {/* Attached images for user */}
            {message.images && message.images.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {message.images.map((img, i) => (
                  <a
                    key={i}
                    href={img}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl overflow-hidden border border-[#4a473f] hover:opacity-90 transition-opacity"
                  >
                    <img
                      src={img}
                      alt="Anexo"
                      className="max-h-48 max-w-full rounded-xl object-contain bg-black/40"
                    />
                  </a>
                ))}
              </div>
            )}

            {/* Attached documents for user */}
            {message.documents && message.documents.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {message.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#23211d] border border-[#444038] text-xs text-[#f3efe6]"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#d97757] flex-shrink-0" />
                    <span className="font-medium truncate max-w-[150px]">{doc.name}</span>
                    <span className="text-[10px] text-[#8c867a] font-mono">{formatFileSize(doc.size)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="text-[15px] leading-relaxed break-words whitespace-pre-wrap font-sans">
              {displayContent}
            </div>
          </div>
        </div>
      ) : (
        /* ================= CLAUDE / ASSISTANT RESPONSE (Editorial Document Style) ================= */
        <div className="flex flex-col items-start w-full">
          {/* Claude Icon / Header */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <ClaudeLogo className="w-5 h-5 text-[#d97757]" />
            <span className="font-serif text-sm font-medium text-[#c4bfb6]">Synap</span>
            {message.isPlanMode && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-[#d97757]/15 text-[#f09a7d] border border-[#d97757]/30 shadow-xs">
                <ListTodo className="w-3.5 h-3.5 text-[#d97757]" />
                <span>Plano Estratégico</span>
              </span>
            )}
          </div>

          {/* Thinking Process Accordion (Dynamic label reflecting selected mode: low / high / max) */}
          {thinkingContent && (
            <div className="w-full mb-3 rounded-xl border border-[#38352e] bg-[#24221e] overflow-hidden">
              <button
                type="button"
                onClick={() => setShowReasoning(!showReasoning)}
                className="w-full px-3.5 py-2 flex items-center justify-between text-xs text-[#a39d93] hover:text-[#f3efe6] hover:bg-[#2c2925] transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2 font-mono flex-wrap">
                  {showReasoning ? (
                    <ChevronDown className="w-3.5 h-3.5 text-[#d97757] flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-[#d97757] flex-shrink-0" />
                  )}
                  <span className="font-medium text-[#c4bfb6]">
                    {message.reasoningEffort === 'low'
                      ? 'Pensamento rápido'
                      : message.reasoningEffort === 'high'
                      ? 'Pensamento aprofundado'
                      : message.reasoningEffort === 'max'
                      ? 'Pensamento estendido'
                      : 'Processo de raciocínio'}
                  </span>

                  {/* Mode Pill Badge */}
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono uppercase font-bold border ${
                      message.reasoningEffort === 'max'
                        ? 'bg-[#d97757]/20 text-[#f09a7d] border-[#d97757]/40'
                        : message.reasoningEffort === 'high'
                        ? 'bg-[#38332a] text-[#e0a96d] border-[#4d4536]'
                        : 'bg-[#292723] text-[#a8a296] border-[#3d3a33]'
                    }`}
                  >
                    {message.reasoningEffort ? `Modo ${message.reasoningEffort}` : 'Raciocínio'}
                  </span>

                  {message.isPlanMode && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] bg-[#d97757]/20 text-[#f09a7d] border border-[#d97757]/30 font-medium">
                      <ListTodo className="w-2.5 h-2.5 text-[#d97757]" />
                      Modo Plano
                    </span>
                  )}

                  <span className="text-[11px] text-[#736e65]">
                    ({thinkingContent.length.toLocaleString()} caracteres)
                  </span>
                </span>
                <span className="text-[10px] text-[#736e65] font-mono flex-shrink-0 ml-2">
                  {showReasoning ? 'Ocultar' : 'Ver processo'}
                </span>
              </button>

              {showReasoning && (
                <div className="px-3.5 py-2.5 text-xs text-[#b8b2a5] font-mono border-t border-[#312f2a] bg-[#1d1b18] leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto">
                  {thinkingContent}
                </div>
              )}
            </div>
          )}

          {/* Edited Files Cards (VS Code style Source Control diff shortcut) */}
          {message.editedFiles && message.editedFiles.length > 0 && (
            <div className="w-full mb-3 space-y-2">
              {message.editedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[#23201c] border border-[#3e392f] flex items-center justify-between gap-3 text-xs shadow-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-[#2e2a22] flex items-center justify-center text-[#d97757] shrink-0">
                      <FileCode className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[#f3efe6] font-mono font-medium truncate">
                          {file.path}
                        </span>
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
                            file.type === 'modified'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : file.type === 'added'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {file.type === 'modified' ? 'Editado' : file.type === 'added' ? 'Criado' : 'Removido'}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#8c867a] mt-0.5">
                        Alteração pronta para revisão no Source Control
                      </p>
                    </div>
                  </div>

                  {onViewDiff && (
                    <button
                      type="button"
                      onClick={() => onViewDiff(file.path)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2f2b23] hover:bg-[#3d372c] text-[#f3efe6] text-xs font-medium border border-[#484133] transition cursor-pointer shrink-0 shadow-xs"
                    >
                      <span>Ver diff</span>
                      <ExternalLink className="w-3.5 h-3.5 text-[#d97757]" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Assistant Rendered Markdown */}
          <div className="w-full prose prose-invert max-w-none text-[15px] sm:text-[16px] text-[#f3efe6] leading-relaxed break-words font-sans">
            {displayContent ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const isInline = !match && !String(children).includes('\n');
                    if (isInline) {
                      return (
                        <code
                          className="bg-[#2a2824] text-[#f09a7d] px-1.5 py-0.5 rounded-md text-[13px] font-mono border border-[#3b3831]"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }
                    return (
                      <CodeBlock
                        language={match ? match[1] : 'text'}
                        value={String(children).replace(/\n$/, '')}
                      />
                    );
                  },
                  table({ children }) {
                    return (
                      <div className="my-3 overflow-x-auto rounded-xl border border-[#3b3831]">
                        <table className="min-w-full divide-y divide-[#3b3831] text-left text-sm">
                          {children}
                        </table>
                      </div>
                    );
                  },
                  th({ children }) {
                    return (
                      <th className="bg-[#24221e] px-4 py-2 font-semibold text-[#f3efe6]">
                        {children}
                      </th>
                    );
                  },
                  td({ children }) {
                    return (
                      <td className="px-4 py-2 text-[#d1cbc0] border-t border-[#312f2a]">
                        {children}
                      </td>
                    );
                  },
                  a({ href, children }) {
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#d97757] hover:text-[#f09a7d] underline underline-offset-2"
                      >
                        {children}
                      </a>
                    );
                  },
                  ul({ children }) {
                    return <ul className="my-2 list-disc pl-5 space-y-1">{children}</ul>;
                  },
                  ol({ children }) {
                    return <ol className="my-2 list-decimal pl-5 space-y-1">{children}</ol>;
                  },
                }}
              >
                {displayContent}
              </ReactMarkdown>
            ) : isStreaming ? (
              <div className="flex items-center gap-1.5 py-2 text-[#d97757]">
                <span className="w-2 h-2 rounded-full bg-[#d97757] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#d97757] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#d97757] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            ) : null}
          </div>

          {/* Action Bar (Claude style subtle bottom icons) */}
          {displayContent && !isStreaming && (
            <div className="flex items-center gap-1 mt-3 pt-2 text-[#8c867a]">
              <button
                type="button"
                onClick={handleCopy}
                aria-label="Copiar mensagem"
                title="Copiar texto"
                className="p-1.5 rounded-lg hover:text-[#f3efe6] hover:bg-[#282622] transition-colors cursor-pointer flex items-center gap-1 text-xs"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[11px] text-emerald-400">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Copiar</span>
                  </>
                )}
              </button>

              <SpeakButton text={displayContent} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
