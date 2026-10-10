import React, { useState } from 'react';
import { Play, CheckCircle2, AlertTriangle, RefreshCw, Save } from 'lucide-react';
import { ActiveRepoState } from '../lib/types';
import { StudioSession, StudioStep } from './studio-types';
import { loadStudioConfig } from '../lib/studio-config';
import { generateId } from '../lib/utils';
import { runPlanner, runReviewer, runImplementer } from './studio-engine';
import { usePendingChanges } from '../lib/pending-changes';

interface Props {
  activeRepo: ActiveRepoState | null;
}

export const StudioPanel: React.FC<Props> = ({ activeRepo }) => {
  const [task, setTask] = useState('');
  const [session, setSession] = useState<StudioSession | null>(null);
  const [feedback, setFeedback] = useState('');
  const { addChange } = usePendingChanges();

  const startStudio = async (customFeedback?: string) => {
    if (!activeRepo || !task.trim()) return;
    
    const config = await loadStudioConfig();
    const newSession: StudioSession = {
      id: session ? session.id : generateId(), // preserve id if retrying
      task,
      repo: activeRepo.fullName,
      branch: activeRepo.branch,
      status: 'planning',
      startedAt: session ? session.startedAt : Date.now(),
      agentConfig: config,
    };
    setSession(newSession);

    try {
      const plan = await runPlanner(task, activeRepo, config.planner, customFeedback);
      setSession(s => s ? { ...s, plan, status: 'reviewing' } : s);

      const review = await runReviewer(plan, task, activeRepo, config.reviewer);
      setSession(s => s ? { ...s, review, status: 'awaiting_approval' } : s);
    } catch (err: any) {
      console.error(err);
      setSession(s => s ? { ...s, status: 'failed' as any } : s);
      alert('Erro na execução do Studio: ' + err.message);
    }
  };

  const approveAndImplement = async () => {
    if (!session || !session.plan || !activeRepo) return;
    setSession(s => s ? { ...s, status: 'implementing' } : s);

    try {
      await runImplementer(
        session.plan, 
        activeRepo, 
        session.agentConfig.implementer, 
        (updatedStep) => {
          setSession(s => {
            if (!s || !s.plan) return s;
            return {
              ...s,
              plan: s.plan.map(p => p.id === updatedStep.id ? updatedStep : p)
            };
          });
        },
        async (path, content, type) => {
          if (!activeRepo) return;
          addChange({
            path,
            newContent: content,
            repo: `${activeRepo.owner}/${activeRepo.repo}`,
            branch: activeRepo.branch,
            type: (type === 'create' ? 'added' : type === 'delete' ? 'deleted' : 'modified') as any,
            originalContent: '' // We don't fetch original here since backend will handle diffing on commit, or we can fetch it but for now we just push to pending.
          });
        }
      );

      setSession(s => s ? { ...s, status: 'completed', completedAt: Date.now() } : s);
    } catch (err: any) {
       setSession(s => s ? { ...s, status: 'failed' as any } : s);
       alert('Erro na implementação: ' + err.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#111217] text-[#f3efe6] p-6 overflow-y-auto">
      <div className="max-w-4xl w-full mx-auto space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="text-amber-400">✨</span> Studio Workspace
        </h1>

        {!session && (
          <div className="bg-[#181714] border border-[#2d2b26] p-4 rounded-xl">
            <textarea
              className="w-full bg-[#111217] border border-[#3b3831] rounded-lg p-3 text-sm focus:border-emerald-500 focus:outline-none"
              rows={4}
              placeholder="Descreva a tarefa complexa..."
              value={task}
              onChange={e => setTask(e.target.value)}
            />
            <button
              onClick={() => startStudio()}
              disabled={!activeRepo || !task.trim()}
              className="mt-3 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              <Play className="w-4 h-4" /> Iniciar Planejamento
            </button>
          </div>
        )}

        {session && (
          <div className="space-y-4">
            {/* Planner Stepper */}
            <div className={`border rounded-xl p-4 transition-colors ${session.status === 'planning' ? 'border-emerald-500/50 bg-[#181714]' : 'border-[#2d2b26] bg-[#111217]'}`}>
              <h2 className="font-bold flex items-center gap-2">
                1️⃣ PLANO <span className="text-xs font-mono text-[#8c867a]">({session.agentConfig.planner.model})</span>
              </h2>
              {session.status === 'planning' && <div className="mt-2 text-sm text-emerald-400 animate-pulse">Analisando repositório e gerando plano...</div>}
              {session.plan && session.status !== 'planning' && (
                <ul className="mt-3 space-y-2 text-sm">
                  {session.plan.map((step, i) => (
                    <li key={i} className="flex flex-col gap-1 bg-[#1b1a17] p-2 rounded">
                      <div className="flex items-start gap-2">
                         <span className="text-[#8c867a]">{step.index}.</span> 
                         <span>{step.description}</span>
                      </div>
                      <div className="text-xs text-[#8c867a] ml-4 font-mono">
                        Ação: {step.action} {step.targetFile ? `→ ${step.targetFile}` : ''}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Reviewer Stepper */}
            {session.status !== 'planning' && (
              <div className={`border rounded-xl p-4 transition-colors ${session.status === 'reviewing' ? 'border-emerald-500/50 bg-[#181714]' : 'border-[#2d2b26] bg-[#111217]'}`}>
                <h2 className="font-bold flex items-center gap-2">
                  2️⃣ REVISÃO <span className="text-xs font-mono text-[#8c867a]">({session.agentConfig.reviewer.model})</span>
                </h2>
                {session.status === 'reviewing' && <div className="mt-2 text-sm text-emerald-400 animate-pulse">Revisando o plano de execução...</div>}
                {session.review && session.status !== 'reviewing' && (
                  <div className="mt-3">
                    <div className="mb-3 text-sm text-[#c4bfb6]">{session.review.summary}</div>
                    <ul className="space-y-2 text-sm mb-4">
                      {session.review.observations.map((obs, i) => (
                        <li key={i} className="flex items-start gap-2 bg-[#1b1a17] p-2 rounded">
                          {obs.type === 'approval' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> : <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${obs.type === 'risk' ? 'text-rose-400' : 'text-amber-400'}`} />}
                          <span>
                            {obs.step ? <span className="font-bold text-[#8c867a] mr-1">Passo {obs.step}:</span> : null}
                            {obs.message}
                          </span>
                        </li>
                      ))}
                    </ul>
                    
                    {session.status === 'awaiting_approval' && (
                      <div className="flex flex-col gap-4 mt-4 border-t border-[#2d2b26] pt-4">
                        <div className="flex flex-col gap-2">
                          <textarea
                            placeholder="Feedback opcional para refazer o plano..."
                            className="w-full bg-[#111217] border border-[#3b3831] rounded p-2 text-sm focus:border-emerald-500 focus:outline-none"
                            rows={2}
                            value={feedback}
                            onChange={e => setFeedback(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <button onClick={approveAndImplement} className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors text-white">
                              <Play className="w-4 h-4" /> Aprovar e Implementar
                            </button>
                            <button onClick={() => startStudio(feedback)} className="bg-[#2d2b26] hover:bg-[#3b3831] text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors">
                              <RefreshCw className="w-4 h-4" /> Refazer Plano
                            </button>
                            <button onClick={() => setSession(null)} className="bg-rose-900/40 hover:bg-rose-900/60 px-4 py-2 rounded text-sm font-medium text-rose-200 transition-colors ml-auto">
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Implementer Stepper */}
            {(session.status === 'implementing' || session.status === 'completed') && (
              <div className={`border rounded-xl p-4 transition-colors ${session.status === 'implementing' ? 'border-emerald-500/50 bg-[#181714]' : 'border-[#2d2b26] bg-[#111217]'}`}>
                <h2 className="font-bold flex items-center gap-2">
                  3️⃣ IMPLEMENTAÇÃO <span className="text-xs font-mono text-[#8c867a]">({session.agentConfig.implementer.model})</span>
                </h2>
                <div className="mt-3 space-y-2 text-sm">
                  {session.plan?.map((step, i) => (
                    <div key={i} className="flex items-center gap-2 bg-[#1b1a17] p-2 rounded">
                      <span className="w-5 text-center shrink-0">
                        {step.status === 'completed' ? '✅' : step.status === 'in_progress' ? '⏳' : step.status === 'failed' ? '❌' : '⏸️'}
                      </span>
                      <div className="flex-1">
                        <div>{step.description}</div>
                        {step.result && <div className="text-xs text-[#8c867a] mt-1">{step.result}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                {session.status === 'completed' && (
                  <div className="mt-4 p-3 bg-emerald-900/20 border border-emerald-800/30 rounded text-emerald-400 text-sm flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <div>
                      <p className="font-bold">Implementação concluída!</p>
                      <p className="opacity-80">As alterações foram enviadas para o Source Control. Abra o Source Control para revisar o diff e commitar.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

