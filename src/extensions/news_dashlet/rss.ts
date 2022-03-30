import FeedParser from 'feedparser';
import { IncomingMessage } from 'http';
import { get } from 'https';
import * as url from 'url';

export interface IEnclosure {
  length: string;
  type: string;
  url: string;
}

export interface IFeedMessage {
  guid: string;
  title: string;
  summary: string;
  description: string;
  categories?: string[];
  link: string;
  titleRendered?: React.ReactChild[];
  descriptionShortened?: React.ReactChild;
  descriptionRendered?: React.ReactChild[];
  enclosures: IEnclosure[];
  'nexusmods:downloads'?: { '#': string };
  'nexusmods:endorsements'?: { '#': string };
  'nexusmods:comments'?: { '#': string };
  'nexusmods:summary'?: { '#': string };
}

function retrieve(rssUrl: string): Promise<IFeedMessage[]> {
  return new Promise<IFeedMessage[]>((resolve, reject) => {
    get({
      ...url.parse(rssUrl),
      headers: { 'User-Agent': 'Vortex', Cookie: 'rd=true' },

    } as any, (res: IncomingMessage) => {
      const { statusCode } = res;
      const contentType = res.headers['content-type'];

      let err: string;
      if (statusCode !== 200) {
        err = `Request Failed. Status Code: ${statusCode}`;
      }

      const parser = new FeedParser();

      const result: IFeedMessage[] = [];

      parser.on('error', error => {
        res.destroy();
        reject(error);
      });
      parser.on('readable', () => {
        while (true) {
          const item = parser.read();
          if (item === null) {
            break;
          } else {
            result.push(item);
          }
        }
      });
      parser.on('end', () => {
        resolve(result);
      });

      if (err !== undefined) {
        res.resume();
        return reject(new Error(err));
      }

      res.pipe(parser);
    })
      .on('error', (err: Error) => {
        return reject(err);
      });
  });
}

export default retrieve;
