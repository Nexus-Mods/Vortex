import * as Promise from 'bluebird';

export type ProtocolHandlers = { [schema: string]: (inputUrl: string) => Promise<string[]> };
