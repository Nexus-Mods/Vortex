import * as Promise from 'bluebird';

export interface IBrowserResult {
  url: string | (() => Promise<string>);
  referer?: string | (() => Promise<string>);
}
