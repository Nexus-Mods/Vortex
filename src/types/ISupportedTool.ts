import * as Promise from 'bluebird';

export interface ISupportedTool {
  id: string;
  name: string;
  logo?: string;
  location: () => string | Promise<string>;
}
