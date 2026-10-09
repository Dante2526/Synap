import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, ChevronRight, Copy, Check, FileText, ListTodo, FileCode, ExternalLink, Loader2, Terminal, RefreshCw } from 'lucide-react';
import { ThinkingOrb } from 'thinking-orbs';
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

const ChatImage: React.FC<{ src?: string; alt?: string }> = ({ src, alt }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [currentSrc, setCurrentSrc] = useState(src || '');
  const MAX_RETRIES = 15;

  React.useEffect(() => {
    setLoaded(false);
    setError(false);
    setRetryCount(0);
    setCurrentSrc(src || '');
  }, [src]);

  const handleError = () => {
    if (retryCount < MAX_RETRIES) {
      const nextRetry = retryCount + 1;
      setRetryCount(nextRetry);
      // Tenta recarregar em segundo plano a cada 2s sem poluir a interface
      setTimeout(() => {
        const separator = (src || '').includes('?') ? '&' : '?';
        setCurrentSrc(`${src}${separator}_r=${nextRetry}`);
      }, 2000);
    } else {
      setError(true);
    }
  };

  const handleManualRetry = () => {
    setError(false);
    setLoaded(false);
    setRetryCount(0);
    const separator = (src || '').includes('?') ? '&' : '?';
    setCurrentSrc(`${src}${separator}_t=${Date.now()}`);
  };

  if (!src) return null;

  return (
    <div className="my-3 flex flex-col items-start max-w-md w-full">
      <div className="relative w-full rounded-2xl overflow-hidden border border-[#3e392f] bg-[#1d1b18] shadow-md group min-h-[240px]">
        {/* Enquanto a imagem não estiver 100% pronta, mantém o orbe ativo na tela */}
        {!loaded && !error && (
          <div className="w-full aspect-square flex flex-col items-center justify-center gap-3 p-6 bg-[#1d1b18]">
            <ThinkingOrb
              state="shaping"
              size={64}
              theme="dark"
              speed={1.5}
              aria-label="Criando a imagem…"
            />
            <span className="text-xs font-medium text-[#f09a7d] animate-pulse">
              Criando a imagem…
            </span>
          </div>
        )}

        <img
          src={currentSrc}
          alt={alt || 'Imagem gerada por IA'}
          loading="eager"
          onLoad={() => {
            setLoaded(true);
            setError(false);
          }}
          onError={handleError}
          className={`w-full h-auto object-cover rounded-2xl transition-opacity duration-500 ${
            loaded ? 'opacity-100 block' : 'opacity-0 absolute inset-0 pointer-events-none'
          }`}
        />

        {loaded && (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 backdrop-blur-md p-1 rounded-xl">
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              title="Abrir imagem em tamanho real"
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {error && (
          <div className="w-full p-6 flex flex-col items-center justify-center text-center gap-3 text-rose-300 bg-rose-950/30 border border-rose-900/50 rounded-2xl min-h-[220px]">
            <span className="text-xs font-medium">A geração da imagem demorou mais do que o esperado.</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleManualRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#d97757] hover:bg-[#c86646] text-white text-xs font-medium transition-colors cursor-pointer shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tentar novamente</span>
              </button>
              <a
                href={src}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] underline text-[#d97757] hover:text-[#e08868] p-1.5"
              >
                Ver link direto
              </a>
            </div>
          </div>
        )}
      </div>

      {alt && alt !== 'image' && !alt.startsWith('http') && (
        <span className="text-[11px] text-[#8c867a] mt-1.5 italic px-1 font-sans">
          {alt}
        </span>
      )}
    </div>
  );
};

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

  // Normaliza markdown de imagens para evitar quebras de linha entre ![...] e (...)
  // e converte links diretos do pollinations para markdown de imagem
  const cleanContent = displayContent
    .replace(/!\[([^\]]*)\]\s*\n+\s*\((https?:\/\/[^\s)]+)\)/g, '![$1]($2)')
    .replace(/(^|\n|\s)(https?:\/\/image\.pollinations\.ai\/[^\s)]+)/g, '$1![]($2)');

  const runningTool = message.toolCalls?.find((tc) => tc.status === 'running');
  const waitingTool = message.toolCalls?.find(
    (tc) => tc.status === 'waiting' || tc.status === 'pending'
  );
  const hasRunningTool = Boolean(runningTool);
  const isEditingFile = runningTool?.name === 'edit_file';
  const isWebSearch = runningTool?.name === 'web_search' || runningTool?.name === 'search_web';
  const isImageGen = runningTool?.name === 'generate_image';

  // Quando ferramentas já foram acionadas e a IA está aguardando conclusão em segundo plano para dar o OK do serviço
  const isAwaitingCompletion =
    Boolean(waitingTool) ||
    (isStreaming &&
      !displayContent &&
      Boolean(message.toolCalls && message.toolCalls.length > 0) &&
      !hasRunningTool);

  const getToolActionLabel = (toolName?: string) => {
    switch (toolName) {
      case 'generate_image':
        return 'Criando a imagem…';
      case 'web_search':
      case 'search_web':
        return 'Juntando as fontes…';
      case 'edit_file':
        return 'Editando arquivo…';
      case 'read_file':
        return 'Lendo arquivo…';
      case 'list_files':
        return 'Listando arquivos…';
      case 'search_code':
        return 'Buscando código…';
      default:
        return 'Executando…';
    }
  };

  // Verifica se está na fase inicial de conexão antes de receber tokens de raciocínio ou resposta
  const isConnecting = isStreaming && !thinkingContent && !displayContent && !hasRunningTool;

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
            {hasRunningTool ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#d97757]/15 text-[#f09a7d] border border-[#d97757]/30 shadow-2xs">
                <ThinkingOrb
                  state={isImageGen ? 'shaping' : isWebSearch ? 'weaving' : 'composing'}
                  size={20}
                  theme="dark"
                  speed={1.5}
                  aria-label={
                    isImageGen
                      ? 'Criando a imagem…'
                      : isWebSearch
                      ? 'Juntando as fontes…'
                      : 'Executando…'
                  }
                />
                <span>{isImageGen ? 'Criando imagem' : isWebSearch ? 'Pesquisando' : 'Executando'}</span>
                <span className="px-1.5 py-0.2 rounded bg-[#d97757]/25 text-[#f3efe6] text-[9px] border border-[#d97757]/40">
                  {isImageGen
                    ? 'Criando a imagem…'
                    : isEditingFile
                    ? 'Editando arquivo…'
                    : isWebSearch
                    ? 'Juntando as fontes…'
                    : getToolActionLabel(runningTool?.name)}
                </span>
              </span>
            ) : isAwaitingCompletion ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#d97757]/15 text-[#f09a7d] border border-[#d97757]/30 shadow-2xs">
                <ThinkingOrb state="working" size={20} theme="dark" speed={1.5} aria-label="Aguardando…" />
                <span>Aguardando</span>
                <span className="px-1.5 py-0.2 rounded bg-[#d97757]/25 text-[#f3efe6] text-[9px] border border-[#d97757]/40">
                  Concluindo serviço…
                </span>
              </span>
            ) : isConnecting ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[#d97757]/15 text-[#f09a7d] border border-[#d97757]/30 shadow-2xs">
                <ThinkingOrb state="working" size={20} theme="dark" speed={1.5} aria-label="Conectando…" />
                <span>Conectando…</span>
              </span>
            ) : isStreaming ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[#d97757]/15 text-[#f09a7d] border border-[#d97757]/30 shadow-2xs">
                <ThinkingOrb state="working" size={20} theme="dark" speed={1.5} aria-label="Pensando…" />
                <span>Pensando…</span>
              </span>
            ) : null}
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

          {/* Tool Calls Execution Status */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="w-full mb-3 space-y-2">
              {message.toolCalls.map((tc) => {
                let parsedArgs: any = {};
                try {
                  parsedArgs = JSON.parse(tc.arguments || '{}');
                } catch {}
                const targetParam = parsedArgs.path || parsedArgs.query || parsedArgs.prompt || '';

                if (tc.status === 'running') {
                  const isThisWebSearch = tc.name === 'web_search' || tc.name === 'search_web';
                  const isThisImageGen = tc.name === 'generate_image';
                  const orbState = isThisImageGen ? 'shaping' : isThisWebSearch ? 'weaving' : 'composing';
                  const orbLabel = isThisImageGen ? 'Criando a imagem…' : isThisWebSearch ? 'Juntando as fontes…' : 'Executando…';
                  const actionTitle = isThisImageGen ? 'Criando Imagem' : isThisWebSearch ? 'Pesquisando na Internet' : 'Executando';
                  const actionBadge = isThisImageGen
                    ? 'Criando a imagem…'
                    : isThisWebSearch
                    ? 'Juntando as fontes…'
                    : tc.name === 'edit_file'
                    ? 'Editando arquivo…'
                    : getToolActionLabel(tc.name);
                  const actionDescription = isThisImageGen
                    ? 'Gerando arte com Stable Diffusion / Flux em alta resolução…'
                    : isThisWebSearch
                    ? 'Consultando a web e cruzando informações de fontes confiáveis'
                    : tc.name === 'edit_file'
                    ? 'Alteração em andamento — pronta para revisão no Source Control'
                    : 'Consultando repositório GitHub…';

                  return (
                    <div
                      key={tc.id}
                      className="flex items-center gap-3.5 p-3 rounded-2xl bg-[#24211d] border border-[#d97757]/40 shadow-xs animate-in fade-in duration-300"
                    >
                      <ThinkingOrb
                        state={orbState}
                        size={64}
                        theme="dark"
                        speed={1.5}
                        aria-label={orbLabel}
                      />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#f3efe6]">
                            {actionTitle}
                          </span>
                          <span className="text-[10px] font-sans font-medium px-2 py-0.5 rounded-md bg-[#d97757]/20 text-[#f09a7d] border border-[#d97757]/35">
                            {actionBadge}
                          </span>
                        </div>
                        {targetParam && (
                          <span className="text-[11px] text-[#f09a7d] font-mono mt-0.5 truncate max-w-[260px] sm:max-w-[420px]">
                            {isThisWebSearch || isThisImageGen ? `"${targetParam}"` : targetParam}
                          </span>
                        )}
                        <span className="text-[10px] text-[#8c867a] mt-1 font-sans">
                          {actionDescription}
                        </span>
                      </div>
                    </div>
                  );
                }

                if (tc.status === 'waiting' || tc.status === 'pending') {
                  return (
                    <div
                      key={tc.id}
                      className="flex items-center gap-3.5 p-3 rounded-2xl bg-[#24211d] border border-[#d97757]/40 shadow-xs animate-in fade-in duration-300"
                    >
                      <ThinkingOrb
                        state="working"
                        size={64}
                        theme="dark"
                        speed={1.5}
                        aria-label="Aguardando…"
                      />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#f3efe6]">
                            Aguardando
                          </span>
                          <span className="text-[10px] font-sans font-medium px-2 py-0.5 rounded-md bg-[#d97757]/20 text-[#f09a7d] border border-[#d97757]/35">
                            Aguardando conclusão…
                          </span>
                        </div>
                        {targetParam && (
                          <span className="text-[11px] text-[#f09a7d] font-mono mt-0.5 truncate max-w-[260px] sm:max-w-[420px]">
                            {targetParam}
                          </span>
                        )}
                        <span className="text-[10px] text-[#8c867a] mt-1 font-sans">
                          Aguardando ferramenta em segundo plano para confirmar o serviço concluído…
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={tc.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#24211d] border border-[#383329] text-xs font-mono text-[#c4bfb6] shadow-2xs"
                  >
                    {tc.status === 'error' ? (
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                    ) : (
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    )}
                    <span className="font-semibold text-[#f3efe6]">{tc.name}</span>
                    {targetParam && (
                      <span className="text-[#a39d93] truncate max-w-[260px] sm:max-w-[400px]">
                        {targetParam}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-[#787268] shrink-0 font-sans">
                      {tc.status === 'error' ? 'falhou' : 'concluído'}
                    </span>
                  </div>
                );
              })}
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
                  p({ children }) {
                    return <div className="my-2.5 leading-relaxed">{children}</div>;
                  },
                  img({ src, alt }) {
                    return <ChatImage src={src} alt={alt} />;
                  },
                  a({ href, children }) {
                    if (href && href.includes('image.pollinations.ai')) {
                      return <ChatImage src={href} alt={String(children || 'Imagem gerada')} />;
                    }
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
                {cleanContent}
              </ReactMarkdown>
            ) : isStreaming && !hasRunningTool ? (
              <div className="flex flex-col items-start gap-3 py-3 my-1 animate-in fade-in duration-300">
                <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-[#24211d] border border-[#3a352a] shadow-xs">
                  <ThinkingOrb
                    state="working"
                    size={64}
                    theme="dark"
                    speed={1.5}
                    aria-label={
                      isAwaitingCompletion
                        ? 'Aguardando…'
                        : isConnecting
                        ? 'Conectando…'
                        : 'Pensando…'
                    }
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-[#f3efe6] flex items-center gap-1.5 font-sans">
                      <span>
                        {isAwaitingCompletion
                          ? 'Aguardando…'
                          : isConnecting
                          ? 'Conectando…'
                          : 'Pensando…'}
                      </span>
                      <span className="inline-flex gap-1 text-[#d97757]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#d97757] animate-pulse" />
                      </span>
                    </span>
                    <span className="text-[11px] text-[#9c9589] font-mono mt-0.5">
                      {isAwaitingCompletion
                        ? 'Aguardando ferramenta em segundo plano para confirmar o serviço concluído…'
                        : isConnecting
                        ? 'Estabelecendo conexão com o modelo de IA…'
                        : thinkingContent
                        ? `Processando raciocínio (${thinkingContent.length.toLocaleString()} caracteres)`
                        : message.isPlanMode
                        ? 'Estruturando plano de ação detalhado'
                        : 'Analisando contexto e gerando resposta'}
                    </span>
                  </div>
                </div>
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
