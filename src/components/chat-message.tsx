import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User, ChevronDown, ChevronRight, Brain, Copy, Check } from 'lucide-react';
import { Message } from '../lib/types';
import { formatDate } from '../lib/utils';
import { CodeBlock } from './code-block';
import { SpeakButton } from './speak-button';

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isStreaming = false }) => {
  const isUser = message.role === 'user';
  const [showReasoning, setShowReasoning] = useState(true);
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
    <div
      className={`py-4 px-3 md:px-6 w-full flex ${
        isUser ? 'justify-end' : 'justify-start'
      } transition-colors`}
    >
      <div
        className={`max-w-[94%] md:max-w-[85%] lg:max-w-[78%] flex gap-3 ${
          isUser ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        {/* Avatar */}
        <div className="flex-shrink-0 mt-1">
          {isUser ? (
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-purple-900/20">
              <User className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-purple-600 p-[1px] shadow-md shadow-purple-900/20">
              <div className="w-full h-full bg-zinc-950 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-purple-400" />
              </div>
            </div>
          )}
        </div>

        {/* Content Box */}
        <div className={`flex flex-col min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>
          {/* Header info */}
          <div className="flex items-center gap-2 mb-1 text-[11px] text-zinc-500">
            <span className="font-medium text-zinc-400">
              {isUser ? 'Você' : 'NVIDIA NIM (GLM)'}
            </span>
            <span>•</span>
            <span>{formatDate(message.createdAt)}</span>
          </div>

          {/* User Bubble or Assistant Message */}
          <div
            className={`w-full overflow-hidden ${
              isUser
                ? 'bg-purple-950/40 text-purple-50 border border-purple-500/30 rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm'
                : 'text-zinc-200'
            }`}
          >
            {/* Attached images for user */}
            {isUser && message.images && message.images.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2.5">
                {message.images.map((img, i) => (
                  <a
                    key={i}
                    href={img}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg overflow-hidden border border-purple-500/30 hover:opacity-90 transition-opacity"
                  >
                    <img
                      src={img}
                      alt="Anexo"
                      className="max-h-48 max-w-full rounded object-contain bg-black/40"
                    />
                  </a>
                ))}
              </div>
            )}

            {/* Thinking / Reasoning Section */}
            {!isUser && thinkingContent && (
              <div className="mb-3 rounded-xl border border-purple-500/20 bg-purple-950/20 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowReasoning(!showReasoning)}
                  className="w-full px-3 py-2 flex items-center justify-between text-xs text-purple-300/90 hover:bg-purple-900/20 transition-colors"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Brain className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                    Processo de Raciocínio ({thinkingContent.length} caracteres)
                  </span>
                  {showReasoning ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>

                {showReasoning && (
                  <div className="px-3.5 py-2.5 text-xs text-zinc-400 font-mono border-t border-purple-500/15 bg-black/30 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {thinkingContent}
                  </div>
                )}
              </div>
            )}

            {/* Markdown rendered text */}
            <div className="prose prose-invert prose-purple max-w-none text-[15px] leading-relaxed break-words">
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
                            className="bg-zinc-800/80 text-purple-300 px-1.5 py-0.5 rounded text-[13px] font-mono border border-zinc-700/50"
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
                        <div className="my-4 overflow-x-auto rounded-lg border border-zinc-800">
                          <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
                            {children}
                          </table>
                        </div>
                      );
                    },
                    th({ children }) {
                      return (
                        <th className="bg-zinc-900/80 px-4 py-2 font-semibold text-zinc-200">
                          {children}
                        </th>
                      );
                    },
                    td({ children }) {
                      return (
                        <td className="px-4 py-2 text-zinc-300 border-t border-zinc-800/60">
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
                          className="text-purple-400 hover:text-purple-300 underline underline-offset-2"
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
                <div className="flex items-center gap-1.5 py-1 text-purple-400">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              ) : null}
            </div>

            {/* Assistant message action buttons */}
            {!isUser && displayContent && !isStreaming && (
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-zinc-900 text-zinc-500">
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label="Copiar mensagem"
                  className="p-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors flex items-center gap-1"
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
        </div>
      </div>
    </div>
  );
};
