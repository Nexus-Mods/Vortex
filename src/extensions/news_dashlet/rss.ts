import { HTTPError } from '../../util/CustomErrors';

import * as FeedParser from 'feedparser';
import * as request from 'request';

export interface IFeedMessage {
  guid: string;
  title: string;
  summary: string;
  description: string;
  link: string;
  titleRendered?: React.ReactChild[];
  descriptionRendered?: React.ReactChild[];
}

function retrieve(url: string): Promise<IFeedMessage[]> {
  return new Promise<IFeedMessage[]>((resolve, reject) => {
    const req = request(url);
    const parser = new FeedParser();

    const result: IFeedMessage[] = [];

    parser.on('error', error => {
      req.abort();
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

    req.on('error', error => reject(error));
    req.on('response', response => {
      if (response.statusCode !== 200) {
        return reject(new HTTPError(response.statusCode, response.statusMessage));
      }
      req.pipe(parser);
    });
  });
}

export default retrieve;
