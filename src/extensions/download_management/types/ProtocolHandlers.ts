export type ProtocolHandlers = { [schema: string]: (inputUrl: string) => Promise<string[]> };
