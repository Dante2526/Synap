export type AgentRole = 'planner' | 'reviewer' | 'implementer';

export interface StudioAgent {
  role: AgentRole;
  model: string;
  reasoningEffort: 'low' | 'medium' | 'high' | 'max';
}

export interface StudioStep {
  id: string;
  index: number;
  description: string;
  targetFile?: string;
  action: 'create' | 'modify' | 'delete' | 'read' | 'analyze';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: string;
}

export interface StudioReview {
  approved: boolean;
  observations: Array<{
    type: 'warning' | 'suggestion' | 'risk' | 'approval';
    step?: number;
    message: string;
  }>;
  summary: string;
}

export interface StudioSession {
  id: string;
  task: string;
  repo: string;
  branch: string;
  status: 'planning' | 'reviewing' | 'awaiting_approval' | 'implementing' | 'completed' | 'cancelled';
  plan?: StudioStep[];
  review?: StudioReview;
  startedAt: number;
  completedAt?: number;
  agentConfig: {
    planner: StudioAgent;
    reviewer: StudioAgent;
    implementer: StudioAgent;
  };
}
