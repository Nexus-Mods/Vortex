import Promise from 'bluebird';
import * as https from 'https';
import * as _ from 'lodash';
import * as Redux from 'redux';
import * as url from 'url';

import { IExtensionContext } from '../../types/IExtensionContext';
import { IState } from '../../types/IState';
import { log } from '../../util/log';
import { getSafe } from '../../util/storeHelper';

import { setAnnouncements } from './actions';
import AnnouncementDashlet from './AnnouncementDashlet';
import sessionReducer from './reducers';
import { AnnouncementParseError, IAnnouncement } from './types';

const ANNOUNCEMENT_LINK =
  'https://raw.githubusercontent.com/Nexus-Mods/Vortex/announcements/announcements.json';

function updateAnnouncements(store: Redux.Store<IState>): Promise<void> {
  if (!store.getState().session.base.networkConnected) {
    return Promise.resolve();
  }
  const getHTTPData = (link: string): Promise<IAnnouncement[]> => {
    const sanitizedURL = url.parse(link);
    return new Promise((resolve, reject) => {
      https.get(sanitizedURL.href, res => {
        res.setEncoding('utf-8');
        let output = '';
        res
          .on('data', (data) => output += data)
          .on('end', () => {
            try {
              const parsed: IAnnouncement[] = JSON.parse(output);
              resolve(parsed);
            } catch (err) {
              reject(new AnnouncementParseError(res.statusCode, err.message, link, output));
            }
        });
      }).on('error', (e) => {
        reject(e);
      }).end();
    });
  };

  return getHTTPData(ANNOUNCEMENT_LINK).then((res) => {
    store.dispatch(setAnnouncements(res));
    return Promise.resolve();
  });
}

function init(context: IExtensionContext): boolean {
  context.registerDashlet('Announcements', 1, 3, 200, AnnouncementDashlet,
    (state: IState) => true,
  () => ({}), { closable: true });

  context.registerReducer(['session', 'announcements'], sessionReducer);

  context.once(() => {
    updateAnnouncements(context.api.store)
    .catch(err => {
      log('warn', 'failed to retrieve list of announcements', err);
    });
  });

  return true;
}

export default init;
