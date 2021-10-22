export type StateListners = { path: string[], callback: (previous, current) => void }[]
export type EventListners = { event: string, callback: (event) => void }[]
