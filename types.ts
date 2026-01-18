
export enum Phase {
  PHASE_1 = 'Phase 1: Basic Todo',
  PHASE_2 = 'Phase 2: Priority & Tags',
  PHASE_3 = 'Phase 3: AI Breakdown',
  PHASE_4 = 'Phase 4: Smart Schedule',
  PHASE_5 = 'Phase 5: Agentic Hub'
}

export type Priority = 'low' | 'medium' | 'high';

export interface SubTask {
  id: string;
  text: string;
  completed: boolean;
  priority?: Priority;
  estimatedTime?: string;
}

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  priority?: Priority;
  tags?: string[];
  subTasks?: SubTask[];
  estimatedTime?: string;
  suggestedSlot?: string;
  createdAt: number;
  collapsed?: boolean;
}
