import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AlertCircle, WifiOff, X } from 'lucide-react';
import {
  Conversation,
  Message,
  ModelId,
  ReasoningEffort,
  AppSettings,
  AttachedDocument,
} from './lib/types';
import {
  loadConversations,
  saveConversations,
  loadSettings,
  saveSettings,
  clearAllConversations,
  DEFAULT_SETTINGS,
} from './lib/storage';
import { generateId, generateTitleFromMessage, formatFileSize } from './lib/utils';
import { ChatHeader } from './components/chat-header';
import { ChatSidebar } from './components/chat-sidebar';
import { ChatMessage } from './components/chat-message';
import { ChatInput } from './components/chat-input';
import { SettingsModal } from './components/settings-modal';
import { ClaudeLogo } from './components/claude-logo';

const MODEL_STORAGE_KEY = 'nim_chat_selected_model';
const REASONING_STORAGE_KEY = 'nim_chat_reasoning_effort';

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Settings
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Model & Reasoning Effort
  const [selectedModel, setSelectedModel] = useState<ModelId>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(MODEL_STORAGE_KEY);
      if (saved === 'z-ai/glm-5.3' || saved === 'z-ai/glm-5.3-flash') return saved;
    }
    return 'z-ai/glm-5.3';
  });

  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(REASONING_STORAGE_KEY);
      if (saved === 'low' || saved === 'high' || saved === 'max') return saved;
    }
    return 'low';
  });

  const [isPlanMode, setIsPlanMode] = useState<boolean>(false);

  const handleTogglePlanMode = () => {
    setIsPlanMode((prev) => {
      const next = !prev;
      if (next && reasoningEffort === 'low') {
        setReasoningEffort('high');
        localStorage.setItem(REASONING_STORAGE_KEY, 'high');
      }
      if (activeId) {
        setConversations((all) =>
          all.map((c) =>
            c.id === activeId
              ? {
                  ...c,
                  isPlanMode: next,
                  reasoningEffort: next && c.reasoningEffort === 'low' ? 'high' : c.reasoningEffort,
                  updatedAt: Date.now(),
                }
              : c
          )
        );
      }
      return next;
    });
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initial load
  useEffect(() => {
    // Load settings
    const storedSettings = loadSettings();
    setSettings(storedSettings);

    // Apply dark mode class to html
    if (storedSettings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Load conversations from IndexedDB
    loadConversations().then((loaded) => {
      setConversations(loaded);
      if (loaded.length > 0) {
        setActiveId(loaded[0].id);
        setIsPlanMode(Boolean(loaded[0].isPlanMode));
        if (loaded[0].model === 'z-ai/glm-5.3' || loaded[0].model === 'z-ai/glm-5.3-flash') {
          setSelectedModel(loaded[0].model as ModelId);
        }
        if (loaded[0].reasoningEffort) {
          setReasoningEffort(loaded[0].reasoningEffort);
        }
      }
    });

    // Check server status
    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => {
        setHasApiKey(Boolean(data.hasApiKey));
        setHasGeminiKey(Boolean(data.hasGeminiKey));
      })
      .catch(() => {
        setHasApiKey(false);
        setHasGeminiKey(false);
      });

    // Connectivity listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save conversations to IndexedDB whenever conversations state changes
  useEffect(() => {
    if (settings.saveHistoryLocally) {
      saveConversations(conversations);
    }
  }, [conversations, settings.saveHistoryLocally]);

  // Persist model selection
  const handleSelectModel = (model: ModelId) => {
    setSelectedModel(model);
    localStorage.setItem(MODEL_STORAGE_KEY, model);
  };

  // Persist reasoning effort
  const handleSelectReasoningEffort = (effort: ReasoningEffort) => {
    setReasoningEffort(effort);
    localStorage.setItem(REASONING_STORAGE_KEY, effort);
  };

  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    saveSettings(updated);

    if (updated.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Active conversation object
  const activeConversation = conversations.find((c) => c.id === activeId) || null;

  // Auto-scroll to bottom of chat
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    scrollToBottom('instant');
  }, [activeId]);

  useEffect(() => {
    if (isStreaming) {
      scrollToBottom('smooth');
    }
  }, [conversations, isStreaming, scrollToBottom]);

  // Start a new chat
  const handleNewChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
    setActiveId(null);
    setErrorMessage(null);
    setIsPlanMode(false);
  };

  // Select a conversation
  const handleSelectConversation = (id: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
    setActiveId(id);
    setErrorMessage(null);

    // Sync model & reasoning effort & plan mode from conversation if present
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      if (conv.model === 'z-ai/glm-5.3' || conv.model === 'z-ai/glm-5.3-flash') {
        setSelectedModel(conv.model as ModelId);
      }
      if (conv.reasoningEffort) {
        setReasoningEffort(conv.reasoningEffort);
      }
      setIsPlanMode(Boolean(conv.isPlanMode));
    }
  };

  // Delete conversation
  const handleDeleteConversation = (id: string) => {
    const updated = conversations.filter((c) => c.id !== id);
    setConversations(updated);
    if (activeId === id) {
      const nextActive = updated.length > 0 ? updated[0] : null;
      setActiveId(nextActive ? nextActive.id : null);
      setIsPlanMode(Boolean(nextActive?.isPlanMode));
    }
  };

  // Rename conversation
  const handleRenameConversation = (id: string, newTitle: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle, updatedAt: Date.now() } : c))
    );
  };

  // Clear all conversations
  const handleClearHistory = async () => {
    await clearAllConversations();
    setConversations([]);
    setActiveId(null);
  };

  // Stop Generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  };

  // Send Message
  const handleSendMessage = async (
    text: string,
    images: string[] = [],
    documents: AttachedDocument[] = [],
    overridePlanMode?: boolean
  ) => {
    if (!text && images.length === 0 && documents.length === 0) return;
    setErrorMessage(null);

    const activePlan = overridePlanMode !== undefined ? overridePlanMode : isPlanMode;

    // Auto-switch to GLM-5.3-Flash if images are attached
    let effectiveModel = selectedModel;
    if (images.length > 0 && selectedModel !== 'z-ai/glm-5.3-flash') {
      effectiveModel = 'z-ai/glm-5.3-flash';
      setSelectedModel('z-ai/glm-5.3-flash');
      localStorage.setItem(MODEL_STORAGE_KEY, 'z-ai/glm-5.3-flash');
    }

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: text,
      images: images.length > 0 ? images : undefined,
      documents: documents.length > 0 ? documents : undefined,
      isPlanMode: activePlan,
      createdAt: Date.now(),
    };

    let currentConvId = activeId;
    let currentConv = activeConversation;

    if (!currentConvId || !currentConv) {
      // Create new conversation
      const newId = generateId();
      const firstDocName = documents[0]?.name;
      const titleFallback = firstDocName ? `Arquivo: ${firstDocName}` : (images.length > 0 ? 'Imagem' : 'Nova conversa');
      const newTitle = generateTitleFromMessage(text || titleFallback);
      const newConv: Conversation = {
        id: newId,
        title: newTitle,
        messages: [userMessage],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        model: effectiveModel,
        reasoningEffort: reasoningEffort,
        isPlanMode: activePlan,
      };

      currentConvId = newId;
      currentConv = newConv;
      setConversations((prev) => [newConv, ...prev]);
      setActiveId(newId);
    } else {
      // Append to existing conversation
      const updatedMessages = [...currentConv.messages, userMessage];
      setConversations((prev) =>
        prev.map((c) =>
          c.id === currentConvId
            ? { ...c, messages: updatedMessages, isPlanMode: activePlan, updatedAt: Date.now() }
            : c
        )
      );
    }

    // Create placeholder for assistant response
    const assistantMessageId = generateId();
    const assistantPlaceholder: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      reasoning: '',
      reasoningEffort: reasoningEffort,
      isPlanMode: activePlan,
      createdAt: Date.now(),
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === currentConvId
          ? { ...c, messages: [...c.messages, assistantPlaceholder] }
          : c
      )
    );

    setIsStreaming(true);

    // Prepare payload messages
    const rawMessages = currentConv
      ? [...currentConv.messages, userMessage]
      : [userMessage];

    // Format any message with attached documents into formatted text
    let contextMessages = rawMessages.map((m) => {
      let content = m.content || '';
      if (m.documents && m.documents.length > 0) {
        const docsBlock = m.documents
          .map(
            (doc) =>
              `[Arquivo anexado: ${doc.name} (${formatFileSize(doc.size)})]\n\`\`\`\n${doc.content}\n\`\`\``
          )
          .join('\n\n');
        content = docsBlock + (content ? `\n\n${content}` : '');
      }
      return {
        role: m.role,
        content,
        images: m.images,
      };
    });

    // If Plan Mode is active, inject the Planning directive
    if (activePlan) {
      const planSystemPrompt = {
        role: 'system',
        content:
          'Você é um estrategista e arquiteto de planejamento sênior. O MODO PLANO (FUNÇÃO PLAN) está ATIVADO. Para a solicitação do usuário, crie OBRIGATORIAMENTE um PLANO DE AÇÃO COMPLETO, PRÁTICO E EXECUTÁVEL, formatado estritamente com os seguintes tópicos em Markdown:\n\n' +
          '🎯 1. OBJETIVO & RESULTADO ESPERADO (Definição clara da meta)\n' +
          '📋 2. PRÉ-REQUISITOS & RECURSOS (Ferramentas, materiais ou conhecimentos prévios)\n' +
          '🗓️ 3. FASES CRONOLÓGICAS PASSO A PASSO (Etapas divididas em Fases/Semanas com ações práticas numeradas)\n' +
          '⚠️ 4. RISCOS, DESAFIOS & CONTINGÊNCIAS (Possíveis obstáculos e soluções preventivas)\n' +
          '✅ 5. CRITÉRIOS DE SUCESSO & PRIMEIRO PASSO IMEDIATO (A primeira ação para começar hoje mesmo).',
      };
      contextMessages = [planSystemPrompt as any, ...contextMessages];
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: contextMessages,
          model: effectiveModel,
          reasoning_effort: reasoningEffort,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errMessage = `Erro na requisição (${response.status})`;
        try {
          const errData = await response.json();
          if (errData.error) errMessage = errData.error;
        } catch {
          // ignore json parse error
        }
        throw new Error(errMessage);
      }

      if (!response.body) {
        throw new Error('Nenhuma resposta retornada pelo servidor.');
      }

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let assistantText = '';
      let reasoningText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // keep incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const dataStr = trimmed.replace(/^data:\s*/, '');
          if (dataStr === '[DONE]') {
            break;
          }

          try {
            const parsed = JSON.parse(dataStr);
            const choice = parsed.choices?.[0];
            const delta = choice?.delta;

            if (delta) {
              // Check if reasoning content was sent
              if (delta.reasoning_content) {
                reasoningText += delta.reasoning_content;
              } else if (delta.reasoning) {
                reasoningText += delta.reasoning;
              }

              if (delta.content) {
                assistantText += delta.content;
              }

              // Update the message in state
              setConversations((prev) =>
                prev.map((c) => {
                  if (c.id !== currentConvId) return c;
                  return {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === assistantMessageId
                        ? {
                            ...m,
                            content: assistantText,
                            reasoning: reasoningText || undefined,
                          }
                        : m
                    ),
                  };
                })
              );
            }
          } catch {
            // Non-JSON line or chunk boundary, continue
          }
        }
      }

      // Final check: if thinking tags are inside content, parse them
      if (!reasoningText && assistantText.includes('<think>')) {
        const thinkMatch = assistantText.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
        if (thinkMatch) {
          reasoningText = thinkMatch[1].trim();
          assistantText = assistantText.replace(/<think>[\s\S]*?(?:<\/think>|$)/, '').trim();
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id !== currentConvId) return c;
              return {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === assistantMessageId
                    ? {
                        ...m,
                        content: assistantText,
                        reasoning: reasoningText,
                      }
                    : m
                ),
              };
            })
          );
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User explicitly stopped generation
        console.log('Geração interrompida pelo usuário.');
      } else {
        console.error('Chat generation error:', err);
        setErrorMessage(err.message || 'Falha ao gerar resposta da IA.');
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const starterSuggestions = [
    {
      category: 'Análise & Conceito',
      title: 'Explicar arquitetura',
      desc: 'Como funciona o mecanismo de Attention nos modelos Transformer?',
      model: 'z-ai/glm-5.3' as ModelId,
      planMode: false,
    },
    {
      category: 'Código & Algoritmo',
      title: 'Algoritmo TypeScript',
      desc: 'Escreva uma função debounce com cancelamento e tipagem estrita.',
      model: 'z-ai/glm-5.3' as ModelId,
      planMode: false,
    },
    {
      category: 'Visão & Diagnóstico',
      title: 'Análise de Imagens',
      desc: 'Use o modelo Flash para anexar capturas de tela e obter diagnósticos.',
      model: 'z-ai/glm-5.3-flash' as ModelId,
      planMode: false,
    },
    {
      category: 'Estratégia & Roteiro',
      title: 'Criar Plano Estruturado',
      desc: 'Ative a Função Plan para gerar um roteiro de ação com cronograma e fases.',
      model: 'z-ai/glm-5.3' as ModelId,
      planMode: true,
    },
  ];

  return (
    <div className="flex h-screen h-[100dvh] max-h-[100dvh] w-full bg-[#1b1a17] text-[#f3efe6] overflow-hidden font-sans">
      {/* Offline Alert Bar */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-[#8c4a2f] text-white text-xs py-1.5 px-4 flex items-center justify-center gap-2 shadow-md">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Modo Offline — Você pode visualizar conversas salvas no histórico.</span>
        </div>
      )}

      {/* Sidebar */}
      <ChatSidebar
        conversations={conversations}
        activeId={activeId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden bg-[#1b1a17]">
        {/* Header */}
        <ChatHeader
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onNewChat={handleNewChat}
          hasApiKey={hasApiKey}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="mx-3 sm:mx-6 mt-3 p-3 rounded-xl bg-[#2e1d1a] border border-[#7a3429] text-[#f4ada3] text-xs flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#d97757] flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="p-1 hover:text-white text-[#f4ada3] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Messages or Empty State */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {!activeConversation || activeConversation.messages.length === 0 ? (
            /* Claude.ai Empty Landing Screen */
            <div className="h-full flex flex-col items-center justify-center px-4 sm:px-6 max-w-2xl mx-auto text-center py-4 sm:py-8 relative animate-in fade-in duration-300">
              {/* Claude 8-pointed Asterisk Glyph */}
              <div className="mb-3 sm:mb-4 flex items-center justify-center">
                <ClaudeLogo className="w-10 h-10 sm:w-12 sm:h-12 text-[#d97757]" />
              </div>

              {/* Editorial Serif Heading like Claude.ai */}
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-normal text-[#f3efe6] tracking-tight mb-2">
                {getGreeting()}, como posso ajudar?
              </h2>
              <p className="text-xs sm:text-sm text-[#a39d93] max-w-md mb-6 sm:mb-8 px-2 leading-relaxed">
                Synap com modelos <span className="text-[#f3efe6] font-medium">GLM-5.3</span> e{' '}
                <span className="text-[#f3efe6] font-medium">Flash</span> via NVIDIA NIM. Raciocínio estendido e Modo Plano integrados.
              </p>

              {/* Claude Prompt Starters Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5 w-full text-left">
                {starterSuggestions.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (item.model) handleSelectModel(item.model);
                      if (item.planMode) {
                        setIsPlanMode(true);
                        if (reasoningEffort === 'low') {
                          setReasoningEffort('high');
                          localStorage.setItem(REASONING_STORAGE_KEY, 'high');
                        }
                      }
                      handleSendMessage(item.desc, [], [], item.planMode);
                    }}
                    className="p-3.5 sm:p-4 rounded-xl border border-[#38352e] bg-[#24221e] hover:bg-[#2c2925] hover:border-[#4d483e] text-[#d8d3c9] transition-all group cursor-pointer text-left shadow-xs flex flex-col justify-between active:scale-[0.99]"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-medium text-[#d97757]">
                        {item.category}
                      </span>
                      <span className="text-[10px] font-mono text-[#736e65]">
                        {item.model === 'z-ai/glm-5.3-flash' ? 'Flash' : 'GLM-5.3'}
                      </span>
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-medium text-[#f3efe6] group-hover:text-white mb-1">
                        {item.title}
                      </div>
                      <div className="text-[11px] sm:text-xs text-[#a39d93] line-clamp-2 leading-relaxed">
                        {item.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Message List */
            <div className="py-4 divide-y divide-[#2d2a24]/60">
              {activeConversation.messages.map((msg, index) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  isStreaming={isStreaming && index === activeConversation.messages.length - 1}
                />
              ))}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Chat Input Bar */}
        <ChatInput
          onSendMessage={handleSendMessage}
          onStopGeneration={handleStopGeneration}
          isLoading={isStreaming}
          isFlashModel={selectedModel === 'z-ai/glm-5.3-flash'}
          selectedModel={selectedModel}
          onSelectModel={handleSelectModel}
          reasoningEffort={reasoningEffort}
          onSelectReasoningEffort={handleSelectReasoningEffort}
          isPlanMode={isPlanMode}
          onTogglePlanMode={handleTogglePlanMode}
        />
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        conversations={conversations}
        onClearHistory={handleClearHistory}
        hasApiKey={hasApiKey}
        hasGeminiKey={hasGeminiKey}
      />
    </div>
  );
}
