import Promise from 'bluebird';

export interface IResolvedURL {
  urls: string[];
  updatedUrl?: string;
  meta: any;
}

export interface IResolvedURLs {
  urls: string[];
  updatedUrls?: string[];
  meta: any;
}

export interface IProtocolHandlers {
  [schema: string]: (inputUrl: string, name: string, friendlyName: string)
    => Promise<IResolvedURL>;
}
