export type StateListeners = Array<{ path: string[], callback: (previous, current) => void }>;
export type EventListeners = Array<{ event: string, callback: (event) => void }>;
