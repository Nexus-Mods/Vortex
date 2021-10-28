export type StateListeners = { path: string[], callback: (previous, current) => void }[]
export type EventListeners = { event: string, callback: (event) => void }[]
