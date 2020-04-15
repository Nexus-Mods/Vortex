import * as Promise from 'bluebird';

export interface IProtocolHandlers {
  [schema: string]: (inputUrl: string, name: string) => Promise<{ urls: string[], meta: any }>;
}
