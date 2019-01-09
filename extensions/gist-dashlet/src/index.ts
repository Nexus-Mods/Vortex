import { setGists } from './actions';
import sessionReducer from './reducers';

import * as Promise from 'bluebird';
import * as https from 'https';
import * as url from 'url';
import * as _ from 'lodash';
import * as path from 'path';
import * as Redux from 'redux';
import { log, types, util } from 'vortex-api';
import GistDashlet from './gistDashlet';

const GIST_LINK = 'https://gist.githubusercontent.com/IDCs/84233f3b6caa4d584fa378271215fad9/raw/feed.json';

function updateGists(store: Redux.Store<any>): Promise<void> {
  const getHTTPData = (link): Promise<any> => {
    const sanitizedURL = url.parse(link);
    return new Promise((resolve, reject) => {
      https.get(sanitizedURL.href, res => {
        res.setEncoding('utf-8');
        let output = '';
        res
          .on('data', (data) => output += data)
          .on('end', () => {
            try {
              const parsed = JSON.parse(output)
              resolve(parsed);
            } catch (err) {
              reject(`statusCode: "${res.statusCode}" - ${err.message} - received: "${output}"`);
            }
        })
      }).on('error', (e) => {
        reject(e);
      }).end();
    })
  }

  return getHTTPData(GIST_LINK).then((res) => {
    store.dispatch(setGists(res));
    return Promise.resolve();
  });
}

function main(context: types.IExtensionContext) {
  context.registerDashlet('gistlog', 1, 3, 200, GistDashlet,
    (state: types.IState) => {
      const gists = util.getSafe(state, ['session', 'gists', 'gists'], undefined);
      return (gists !== undefined) && (Object.keys(gists).length > 0);
    },
  () => ({}), { closable: true });

  context.registerReducer(['session', 'gists'], sessionReducer);

  context.once(() => {
    context.api.setStylesheet('gistlog',
      path.join(__dirname, 'gistlog.scss'));
    updateGists(context.api.store)
    .catch(err => {
      log('warn', 'failed to retrieve list of gists', err.message);
    });
  });

  return true;
}

export default main;
