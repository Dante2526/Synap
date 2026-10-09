import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AlertCircle, WifiOff, X, GitBranch, ExternalLink, FileCode, Check } from 'lucide-react';
import {
  Conversation,
  Message,
  ModelId,
  ReasoningEffort,
  AppSettings,
  AttachedDocument,
  ActiveRepoState,
  PendingChange,
  MessageEditedFile,
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
import { PendingChangesProvider, usePendingChanges } from './lib/pending-changes';
import { DiffViewer } from './components/source-control/diff-viewer';
import { getOctokit, fetchFileContent, fetchRepoContents, searchCode } from './lib/github';

const MODEL_STORAGE_KEY = 'nim_chat_selected_model';
const REASONING_STORAGE_KEY = 'nim_chat_reasoning_effort';

const GITHUB_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Lê conteúdo de um arquivo do repositório ativo',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Caminho relativo do arquivo (ex: src/App.tsx)' },
          branch: { type: 'string', description: 'Branch opcional (padrão: branch ativa)' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'Lista arquivos e diretórios de um caminho no repositório ativo',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Caminho relativo (vazio para a raiz do repositório)' },
          branch: { type: 'string', description: 'Branch opcional' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_code',
      description: 'Busca por ocorrências de texto ou código no repositório ativo',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Termo de busca ou nome de função/classe' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description:
        'Edita ou cria um arquivo no repositório ativo. A alteração fica pendente no Source Control para revisão do usuário e NÃO commita automaticamente.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Caminho relativo do arquivo (ex: src/lib/utils.ts)' },
          content: { type: 'string', description: 'Novo conteúdo completo do arquivo' },
          type: {
            type: 'string',
            enum: ['modified', 'added', 'deleted'],
            description: 'Tipo de modificação: modified, added ou deleted',
          },
        },
        required: ['path', 'content', 'type'],
      },
    },
  },
];

export default function App() {
  return (
    <PendingChangesProvider>
      <AppContent />
    </PendingChangesProvider>
  );
}

function AppContent() {
  const {
    changes,
    addChange,
    stageChange,
    unstageChange,
    discardChange,
    updateChangeContent,
  } = usePendingChanges();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean | null>(null);
  const [hasGitHubToken, setHasGitHubToken] = useState<boolean | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Settings
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // GitHub & Source Control state
  const [sidebarTab, setSidebarTab] = useState<'chats' | 'repos' | 'source-control'>('chats');
  const [activeRepo, setActiveRepo] = useState<ActiveRepoState | null>(null);

  const [diffViewingChange, setDiffViewingChange] = useState<PendingChange | null>(null);
  const [toastNotification, setToastNotification] = useState<{
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

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

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check backend server status
  useEffect(() => {
    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => {
        setHasApiKey(Boolean(data.hasApiKey));
        setHasGeminiKey(Boolean(data.hasGeminiKey));
        setHasGitHubToken(Boolean(data.hasGitHubToken));
      })
      .catch((err) => {
        console.warn('Could not verify server status:', err);
        setHasApiKey(false);
        setHasGitHubToken(false);
      });
  }, []);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load Settings and Conversations
  useEffect(() => {
    const loadedSettings = loadSettings();
    setSettings(loadedSettings);

    loadConversations().then((loaded) => {
      setConversations(loaded);
      if (loaded.length > 0) {
        setActiveId(loaded[0].id);
        if (loaded[0].model) setSelectedModel(loaded[0].model as ModelId);
        if (loaded[0].reasoningEffort) setReasoningEffort(loaded[0].reasoningEffort);
        if (loaded[0].isPlanMode !== undefined) setIsPlanMode(loaded[0].isPlanMode);
        if (loaded[0].activeRepo) setActiveRepo(loaded[0].activeRepo);
        else setActiveRepo(null);
      }
    });
  }, []);

  // Persist conversations
  useEffect(() => {
    if (conversations.length > 0 && settings.saveHistoryLocally) {
      saveConversations(conversations);
    }
  }, [conversations, settings.saveHistoryLocally]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversations, isStreaming]);

  // Active conversation helper
  const activeConversation = conversations.find((c) => c.id === activeId) || null;

  // Active repo changes count
  const pendingChangesCount = activeRepo
    ? changes.filter(
        (c) => c.repo === activeRepo.fullName && c.branch === activeRepo.branch
      ).length
    : 0;

  const handleSelectRepo = (repo: ActiveRepoState) => {
    setActiveRepo(repo);
    if (activeId) {
      setConversations((all) =>
        all.map((c) =>
          c.id === activeId ? { ...c, activeRepo: repo, updatedAt: Date.now() } : c
        )
      );
    }
  };

  const handleCloseRepo = () => {
    setActiveRepo(null);
    if (activeId) {
      setConversations((all) =>
        all.map((c) =>
          c.id === activeId ? { ...c, activeRepo: null, updatedAt: Date.now() } : c
        )
      );
    }
  };

  const handleChangeBranch = (branch: string) => {
    if (!activeRepo) return;
    const updated = { ...activeRepo, branch };
    setActiveRepo(updated);
    if (activeId) {
      setConversations((all) =>
        all.map((c) =>
          c.id === activeId ? { ...c, activeRepo: updated, updatedAt: Date.now() } : c
        )
      );
    }
  };

  const handleViewDiffForPath = (path: string) => {
    const found = changes.find(
      (c) => c.path === path && (activeRepo ? c.repo === activeRepo.fullName : true)
    );
    if (found) {
      setDiffViewingChange(found);
    } else {
      setSidebarTab('source-control');
      setIsSidebarOpen(true);
    }
  };

  const handleTogglePlanMode = () => {
    setIsPlanMode((prev) => {
      const next = !prev;
      if (next && reasoningEffort === 'low') {
        setReasoningEffort('high');
        localStorage.setItem(REASONING_STORAGE_KEY, 'high');
      }
      if (activeId) {
        setConversations((all) =>
          all.map((c) => (c.id === activeId ? { ...c, isPlanMode: next } : c))
        );
      }
      return next;
    });
  };

  const handleSelectModel = (model: ModelId) => {
    setSelectedModel(model);
    localStorage.setItem(MODEL_STORAGE_KEY, model);
    if (activeId) {
      setConversations((prev) =>
        prev.map((c) => (c.id === activeId ? { ...c, model, updatedAt: Date.now() } : c))
      );
    }
  };

  const handleSelectReasoningEffort = (effort: ReasoningEffort) => {
    setReasoningEffort(effort);
    localStorage.setItem(REASONING_STORAGE_KEY, effort);
    if (activeId) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId ? { ...c, reasoningEffort: effort, updatedAt: Date.now() } : c
        )
      );
    }
  };

  const handleNewChat = () => {
    setActiveId(null);
    setIsPlanMode(false);
    setActiveRepo(null);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const handleSelectConversation = (id: string) => {
    setActiveId(id);
    const target = conversations.find((c) => c.id === id);
    if (target) {
      if (target.model) setSelectedModel(target.model as ModelId);
      if (target.reasoningEffort) setReasoningEffort(target.reasoningEffort);
      if (target.isPlanMode !== undefined) {
        setIsPlanMode(target.isPlanMode);
      } else {
        setIsPlanMode(false);
      }
      setActiveRepo(target.activeRepo || null);
    }
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const handleDeleteConversation = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) {
      const remaining = conversations.filter((c) => c.id !== id);
      if (remaining.length > 0) {
        setActiveId(remaining[0].id);
        if (remaining[0].model) setSelectedModel(remaining[0].model as ModelId);
        if (remaining[0].reasoningEffort) setReasoningEffort(remaining[0].reasoningEffort);
        if (remaining[0].isPlanMode !== undefined) setIsPlanMode(remaining[0].isPlanMode);
        setActiveRepo(remaining[0].activeRepo || null);
      } else {
        setActiveId(null);
        setIsPlanMode(false);
        setActiveRepo(null);
      }
    }
  };

  const handleRenameConversation = (id: string, newTitle: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle, updatedAt: Date.now() } : c))
    );
  };

  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      saveSettings(updated);
      return updated;
    });
  };

  const handleClearHistory = async () => {
    await clearAllConversations();
    setConversations([]);
    setActiveId(null);
    setIsPlanMode(false);
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  };

  // Helper to execute client-side GitHub tools
  const executeGitHubTool = async (
    name: string,
    args: any,
    currentRepo: ActiveRepoState | null
  ): Promise<{ result: string; editedFile?: MessageEditedFile }> => {
    if (!currentRepo) {
      return {
        result: JSON.stringify({
          error: 'Nenhum repositório GitHub está vinculado a esta conversa. Acesso negado.',
        }),
      };
    }

    if (name === 'edit_file') {
      const { path, content, type } = args;
      let originalContent: string | undefined = undefined;

      // Try fetching original file content if modifying or deleting
      if (type === 'modified' || type === 'deleted') {
        try {
          originalContent = await fetchFileContent(
            null,
            currentRepo.owner,
            currentRepo.repo,
            path,
            currentRepo.branch
          );
        } catch {
          // New file or unable to read original
        }
      }

      await addChange({
        path,
        repo: currentRepo.fullName,
        branch: currentRepo.branch,
        type: type || 'modified',
        originalContent,
        newContent: content || '',
      });

      // Show toast
      setToastNotification({
        message: `IA editou ${path} — revise em Source Control`,
        actionLabel: 'Ver Diff',
        onAction: () => {
          handleViewDiffForPath(path);
        },
      });

      setTimeout(() => {
        setToastNotification(null);
      }, 5000);

      const editedFile: MessageEditedFile = {
        path,
        type: type || 'modified',
      };

      return {
        result: JSON.stringify({
          success: true,
          message: `Arquivo '${path}' alterado com sucesso e salvo no Source Control local para revisão do usuário.`,
        }),
        editedFile,
      };
    }

    if (name === 'read_file') {
      try {
        const fileContent = await fetchFileContent(
          null,
          currentRepo.owner,
          currentRepo.repo,
          args.path,
          args.branch || currentRepo.branch
        );
        return { result: fileContent };
      } catch (err: any) {
        return { result: JSON.stringify({ error: err?.message || `Erro ao ler arquivo ${args.path}` }) };
      }
    }

    if (name === 'list_files') {
      try {
        const contents = await fetchRepoContents(
          null,
          currentRepo.owner,
          currentRepo.repo,
          args.path || '',
          args.branch || currentRepo.branch
        );
        return { result: JSON.stringify(contents.map((c) => ({ name: c.name, path: c.path, type: c.type }))) };
      } catch (err: any) {
        return { result: JSON.stringify({ error: err?.message || `Erro ao listar diretório ${args.path}` }) };
      }
    }

    if (name === 'search_code') {
      try {
        const items = await searchCode(
          null,
          `${args.query} repo:${currentRepo.fullName}`
        );
        return {
          result: JSON.stringify(items),
        };
      } catch (err: any) {
        return { result: JSON.stringify({ error: err?.message || `Erro na busca de código: ${args.query}` }) };
      }
    }

    return { result: JSON.stringify({ error: `Ferramenta desconhecida: ${name}` }) };
  };

  // Send Message with Tools support
  const handleSendMessage = async (
    text: string,
    images: string[] = [],
    documents: AttachedDocument[] = [],
    overridePlanMode?: boolean
  ) => {
    if (!text && images.length === 0 && documents.length === 0) return;
    setErrorMessage(null);

    const activePlan = overridePlanMode !== undefined ? overridePlanMode : isPlanMode;

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
      const newId = generateId();
      const firstDocName = documents[0]?.name;
      const titleFallback = firstDocName
        ? `Arquivo: ${firstDocName}`
        : images.length > 0
        ? 'Imagem'
        : 'Nova conversa';
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
        activeRepo: activeRepo || null,
      };

      currentConvId = newId;
      currentConv = newConv;
      setConversations((prev) => [newConv, ...prev]);
      setActiveId(newId);
    } else {
      const updatedMessages = [...currentConv.messages, userMessage];
      setConversations((prev) =>
        prev.map((c) =>
          c.id === currentConvId
            ? { ...c, messages: updatedMessages, isPlanMode: activePlan, updatedAt: Date.now() }
            : c
        )
      );
    }

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

    const rawMessages = currentConv
      ? [...currentConv.messages, userMessage]
      : [userMessage];

    let contextMessages: any[] = rawMessages.map((m) => {
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

    // Injetar contexto de repositório apenas se vinculado a esta conversa
    const chatActiveRepo = currentConv?.activeRepo !== undefined ? currentConv.activeRepo : activeRepo;
    if (chatActiveRepo) {
      const repoSystemPrompt = {
        role: 'system',
        content:
          `Você está conectado ao repositório GitHub ativo EXCLUSIVO DESTA CONVERSA: "${chatActiveRepo.fullName}" na branch "${chatActiveRepo.branch}".\n` +
          `Você tem acesso às ferramentas de código: read_file, list_files, search_code e edit_file APENAS para o repositório "${chatActiveRepo.fullName}".\n` +
          `Você NÃO tem permissão nem acesso a nenhum outro repositório do usuário. Cada conversa possui isolamento estrito de repositório.\n` +
          `Ao propor alterações ou códigos para o repositório, utilize OBRIGATORIAMENTE a ferramenta edit_file. ` +
          `A alteração ficará salva localmente no Source Control para o usuário revisar o diff e commitar.`,
      };
      contextMessages = [repoSystemPrompt, ...contextMessages];
    }

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
      contextMessages = [planSystemPrompt, ...contextMessages];
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let currentMessagesForApi = [...contextMessages];
      let hasToolCallsToProcess = true;
      let loopCount = 0;
      const allEditedFiles: MessageEditedFile[] = [];

      while (hasToolCallsToProcess && loopCount < 5) {
        loopCount++;
        hasToolCallsToProcess = false;

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: currentMessagesForApi,
            model: effectiveModel,
            reasoning_effort: reasoningEffort,
            tools: chatActiveRepo ? GITHUB_TOOLS : undefined,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          let errMessage = `Erro na requisição (${response.status})`;
          try {
            const errData = await response.json();
            if (errData.error) errMessage = errData.error;
          } catch {}
          throw new Error(errMessage);
        }

        if (!response.body) {
          throw new Error('Nenhuma resposta retornada pelo servidor.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let assistantText = '';
        let reasoningText = '';
        let buffer = '';
        const toolCallsAccumulator: Record<number, { id: string; name: string; arguments: string }> = {};

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
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
                if (delta.reasoning_content) {
                  reasoningText += delta.reasoning_content;
                } else if (delta.reasoning) {
                  reasoningText += delta.reasoning;
                }

                if (delta.content) {
                  assistantText += delta.content;
                }

                // Accumulate tool calls
                if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index ?? 0;
                    if (!toolCallsAccumulator[idx]) {
                      toolCallsAccumulator[idx] = {
                        id: tc.id || `call_${Date.now()}_${idx}`,
                        name: tc.function?.name || '',
                        arguments: '',
                      };
                    }
                    if (tc.id) toolCallsAccumulator[idx].id = tc.id;
                    if (tc.function?.name) toolCallsAccumulator[idx].name = tc.function.name;
                    if (tc.function?.arguments) toolCallsAccumulator[idx].arguments += tc.function.arguments;
                  }
                }

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
                              editedFiles: allEditedFiles.length > 0 ? allEditedFiles : undefined,
                            }
                          : m
                      ),
                    };
                  })
                );
              }
            } catch {}
          }
        }

        // Process tool calls if any were returned
        const detectedCalls = Object.values(toolCallsAccumulator);
        if (detectedCalls.length > 0 && chatActiveRepo) {
          hasToolCallsToProcess = true;

          const toolResultMessages: any[] = [];
          const assistantToolCallsPayload = detectedCalls.map((c) => ({
            id: c.id,
            type: 'function',
            function: {
              name: c.name,
              arguments: c.arguments,
            },
          }));

          for (const tc of detectedCalls) {
            let parsedArgs: any = {};
            try {
              parsedArgs = JSON.parse(tc.arguments || '{}');
            } catch {
              parsedArgs = {};
            }

            const { result, editedFile } = await executeGitHubTool(tc.name, parsedArgs, chatActiveRepo);
            if (editedFile) {
              allEditedFiles.push(editedFile);
            }

            toolResultMessages.push({
              role: 'tool',
              content: result,
              tool_call_id: tc.id,
            });
          }

          // Update assistant message with edited files
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id !== currentConvId) return c;
              return {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === assistantMessageId
                    ? {
                        ...m,
                        editedFiles: allEditedFiles.length > 0 ? allEditedFiles : undefined,
                      }
                    : m
                ),
              };
            })
          );

          // Prepare payload for next continuation request
          currentMessagesForApi = [
            ...currentMessagesForApi,
            {
              role: 'assistant',
              content: assistantText || null,
              tool_calls: assistantToolCallsPayload,
            },
            ...toolResultMessages,
          ];
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Geração interrompida pelo usuário.');
      } else {
        console.error('Chat generation error:', err);
        setErrorMessage(err.message || 'Falha ao processar resposta da IA.');
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
      category: 'Source Control & GitHub',
      title: activeRepo ? `Explorar ${activeRepo.repo}` : 'Conectar Repositório',
      desc: activeRepo
        ? `Inspecione arquivos e edite código do repositório ${activeRepo.fullName} diretamente no Source Control.`
        : 'Conecte seu GitHub para abrir projetos e deixar a IA editar arquivos com revisão visual de diff.',
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

      {/* Toast notification for AI edits */}
      {toastNotification && (
        <div className="fixed bottom-24 right-4 z-50 max-w-sm p-3 rounded-xl bg-[#23211d] border border-[#d97757]/50 shadow-2xl flex items-center justify-between gap-3 text-xs animate-in slide-in-from-bottom-2 fade-in">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-[#d97757] shrink-0" />
            <span className="text-[#f3efe6] font-medium leading-tight">
              {toastNotification.message}
            </span>
          </div>
          {toastNotification.onAction && toastNotification.actionLabel && (
            <button
              type="button"
              onClick={toastNotification.onAction}
              className="px-2.5 py-1 rounded-lg bg-[#d97757] hover:bg-[#c26647] text-white text-[11px] font-medium transition cursor-pointer shrink-0"
            >
              {toastNotification.actionLabel}
            </button>
          )}
        </div>
      )}

      {/* Sidebar with Chats, Repos and Source Control tabs */}
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
        activeRepo={activeRepo}
        sidebarTab={sidebarTab}
        onChangeTab={setSidebarTab}
        onSelectRepo={handleSelectRepo}
        onCloseRepo={handleCloseRepo}
        onChangeBranch={handleChangeBranch}
        pendingChangesCount={pendingChangesCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden bg-[#1b1a17]">
        {/* Header */}
        <ChatHeader
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onNewChat={handleNewChat}
          hasApiKey={hasApiKey}
          onOpenSettings={() => setIsSettingsOpen(true)}
          activeRepo={activeRepo}
          pendingChangesCount={pendingChangesCount}
          onOpenSourceControl={() => {
            setSidebarTab('source-control');
            setIsSidebarOpen(true);
          }}
          onOpenRepoList={() => {
            setSidebarTab('repos');
            setIsSidebarOpen(true);
          }}
          onCloseRepo={handleCloseRepo}
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
            <div className="h-full flex flex-col items-center justify-center px-4 sm:px-6 max-w-2xl mx-auto text-center py-4 sm:py-8 relative animate-in fade-in duration-300">
              <div className="mb-3 sm:mb-4 flex items-center justify-center">
                <ClaudeLogo className="w-10 h-10 sm:w-12 sm:h-12 text-[#d97757]" />
              </div>

              <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-normal text-[#f3efe6] tracking-tight mb-2">
                {getGreeting()}, como posso ajudar?
              </h2>
              <p className="text-xs sm:text-sm text-[#a39d93] max-w-md mb-6 sm:mb-8 px-2 leading-relaxed">
                Synap com modelos <span className="text-[#f3efe6] font-medium">GLM-5.3</span> e{' '}
                <span className="text-[#f3efe6] font-medium">Flash</span>. Source Control Git e Modo Plano integrados.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5 w-full text-left">
                {starterSuggestions.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (item.category.includes('Source Control') && !activeRepo) {
                        setSidebarTab('repos');
                        setIsSidebarOpen(true);
                        return;
                      }
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
            <div className="py-4 divide-y divide-[#2d2a24]/60">
              {activeConversation.messages.map((msg, index) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  isStreaming={isStreaming && index === activeConversation.messages.length - 1}
                  onViewDiff={handleViewDiffForPath}
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

      {/* Diff Viewer Modal triggered from chat or direct action */}
      {diffViewingChange && (
        <DiffViewer
          change={diffViewingChange}
          isOpen={true}
          onClose={() => setDiffViewingChange(null)}
          onStage={stageChange}
          onUnstage={unstageChange}
          onDiscard={discardChange}
          onUpdateContent={updateChangeContent}
        />
      )}

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
        hasGitHubToken={hasGitHubToken}
      />
    </div>
  );
}
