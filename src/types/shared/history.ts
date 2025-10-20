export interface IHistoryState {
  stacks: { [id: string]: string[] };
  events: { [id: string]: IHistoryEvent };
}

export interface IHistoryPersistent {
  stacks: { [id: string]: IHistoryStack };
  events: { [id: string]: IHistoryEvent };
}

export interface IHistoryEvent {
  id: string;
  type: string;
  timestamp: number;
  context: string;
  title: string;
  description: string;
  actions: Array<{ title: string; action: () => void; }>;
  reverted: boolean;
  stack: string;
  [key: string]: any;
}

export interface IHistoryStack {
  id: string;
  name: string;
  description: string;
  icon: string;
  maxEvents: number;
  [key: string]: any;
}

export enum Revertability {
  Not = 'not',
  Manual = 'manual',
  Automatic = 'automatic',
}