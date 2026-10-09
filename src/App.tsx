import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, Sparkles, AlertCircle, WifiOff, RefreshCw, X, MessageSquarePlus } from 'lucide-react';
import {
  Conversation,
  Message,
  ModelId,
  ReasoningEffort,
  AppSettings,
} from './lib/types';
import {
  loadConversations,
  saveConversations,
  loadSettings,
  saveSettings,
  clearAllConversations,
  DEFAULT_SETTINGS,
} from './lib/storage';
import { generateId, generateTitleFromMessage } from './lib/utils';
import { ChatHeader } from './components/chat-header';
import { ChatSidebar } from './components/chat-sidebar';
import { ChatMessage } from './components/chat-message';
import { ChatInput } from './components/chat-input';
import { SettingsModal } from './components/settings-modal';

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
      }
    });

    // Check server status
    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => {
        setHasApiKey(Boolean(data.hasApiKey));
      })
      .catch(() => {
        setHasApiKey(false);
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
  };

  // Select a conversation
  const handleSelectConversation = (id: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
    setActiveId(id);
    setErrorMessage(null);

    // Sync model & reasoning effort from conversation if present
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      if (conv.model === 'z-ai/glm-5.3' || conv.model === 'z-ai/glm-5.3-flash') {
        setSelectedModel(conv.model as ModelId);
      }
      if (conv.reasoningEffort) {
        setReasoningEffort(conv.reasoningEffort);
      }
    }
  };

  // Delete conversation
  const handleDeleteConversation = (id: string) => {
    const updated = conversations.filter((c) => c.id !== id);
    setConversations(updated);
    if (activeId === id) {
      setActiveId(updated.length > 0 ? updated[0].id : null);
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
  const handleSendMessage = async (text: string, images: string[]) => {
    if (!text && images.length === 0) return;
    setErrorMessage(null);

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: text,
      images: images.length > 0 ? images : undefined,
      createdAt: Date.now(),
    };

    let currentConvId = activeId;
    let currentConv = activeConversation;

    if (!currentConvId || !currentConv) {
      // Create new conversation
      const newId = generateId();
      const newTitle = generateTitleFromMessage(text || 'Imagem');
      const newConv: Conversation = {
        id: newId,
        title: newTitle,
        messages: [userMessage],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        model: selectedModel,
        reasoningEffort: reasoningEffort,
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
            ? { ...c, messages: updatedMessages, updatedAt: Date.now() }
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
    const contextMessages = currentConv
      ? [...currentConv.messages, userMessage]
      : [userMessage];

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
          model: selectedModel,
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

  const starterSuggestions = [
    {
      title: 'Explicar arquitetura',
      desc: 'Como funciona o mecanismo de Attention nos modelos Transformer?',
      model: 'z-ai/glm-5.3' as ModelId,
    },
    {
      title: 'Algoritmo TypeScript',
      desc: 'Escreva uma função debounce com cancelamento e tipagem completa.',
      model: 'z-ai/glm-5.3' as ModelId,
    },
    {
      title: 'Análise de Imagens',
      desc: 'Selecione o modelo Flash para anexar capturas de tela e obter diagnósticos.',
      model: 'z-ai/glm-5.3-flash' as ModelId,
    },
    {
      title: 'Raciocínio Profundo',
      desc: 'Resolva um problema de lógica passo a passo usando o reasoning max.',
      model: 'z-ai/glm-5.3' as ModelId,
    },
  ];

  return (
    <div className="flex h-screen w-full bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Offline Alert Bar */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-600/90 text-white text-xs py-1.5 px-4 flex items-center justify-center gap-2 shadow-md">
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
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Header */}
        <ChatHeader
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onNewChat={handleNewChat}
          selectedModel={selectedModel}
          onSelectModel={handleSelectModel}
          reasoningEffort={reasoningEffort}
          onSelectReasoningEffort={handleSelectReasoningEffort}
          hasApiKey={hasApiKey}
        />

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="p-1 hover:text-white text-rose-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Messages or Empty State */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {!activeConversation || activeConversation.messages.length === 0 ? (
            /* Empty Landing Screen */
            <div className="h-full flex flex-col items-center justify-center px-4 max-w-2xl mx-auto text-center py-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 p-[1px] shadow-xl shadow-purple-900/30 mb-5 animate-in fade-in zoom-in duration-300">
                <div className="w-full h-full bg-zinc-950 rounded-2xl flex items-center justify-center">
                  <Bot className="w-8 h-8 text-purple-400" />
                </div>
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
                Synap
              </h2>
              <p className="text-sm text-zinc-400 max-w-md mb-8">
                Inteligência conectada à NVIDIA NIM com modelos <span className="text-purple-400 font-medium">GLM-5.3</span> e{' '}
                <span className="text-purple-400 font-medium">GLM-5.3-Flash</span>, raciocínio ajustável, visão e voz.
              </p>

              {/* Suggestions grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
                {starterSuggestions.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (item.model) handleSelectModel(item.model);
                      handleSendMessage(item.desc, []);
                    }}
                    className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-850 hover:border-purple-500/40 text-zinc-300 transition-all group cursor-pointer text-left shadow-xs"
                  >
                    <div className="text-xs font-semibold text-zinc-200 group-hover:text-purple-300 flex items-center justify-between mb-1">
                      <span>{item.title}</span>
                      <Sparkles className="w-3 h-3 text-purple-400 opacity-60 group-hover:opacity-100" />
                    </div>
                    <div className="text-[12px] text-zinc-400 line-clamp-2 leading-relaxed">
                      {item.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Message List */
            <div className="py-4 divide-y divide-zinc-900/50">
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
      />
    </div>
  );
}
