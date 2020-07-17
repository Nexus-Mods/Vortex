import Promise from 'bluebird';
import * as https from 'https';
import * as _ from 'lodash';
import * as path from 'path';
import * as Redux from 'redux';
import * as url from 'url';

import { IExtensionContext } from '../../types/IExtensionContext';
import { IState } from '../../types/IState';
import * as fs from '../../util/fs';
import { log } from '../../util/log';

import sessionReducer from './reducers/announcements';
import persistentReducer from './reducers/persistent';
import surveySessionReducer from './reducers/surveys';

import { setAnnouncements, setAvailableSurveys } from './actions';
import AnnouncementDashlet from './AnnouncementDashlet';
import { IAnnouncement, ISurveyInstance,
  ParserError } from './types';

const ANNOUNCEMENT_LINK =
  'https://raw.githubusercontent.com/Nexus-Mods/Vortex/announcements/announcements.json';

const SURVEYS_LINK =
  'https://raw.githubusercontent.com/Nexus-Mods/Vortex/announcements/surveys.json';

// Can be used for debugging.
const DEBUG_MODE: boolean = false;
const SURVEYS_LOCAL_PATH = path.join(__dirname, 'surveys.json');
function readLocalSurveysFile() {
  return fs.readFileAsync(SURVEYS_LOCAL_PATH)
    .then(data => {
      try {
        const parsed: ISurveyInstance[] = JSON.parse(data);
        return Promise.resolve(parsed);
      } catch (err) {
        return Promise.reject(err);
      }
    });
}

function getHTTPData<T>(link: string): Promise<T[]> {
  const sanitizedURL = url.parse(link);
  return new Promise((resolve, reject) => {
    https.get(sanitizedURL.href, res => {
      res.setEncoding('utf-8');
      let output = '';
      res
        .on('data', (data) => output += data)
        .on('end', () => {
          try {
            const parsed: T[] = JSON.parse(output);
            resolve(parsed);
          } catch (err) {
            reject(new ParserError(res.statusCode, err.message, link, output));
          }
      });
    }).on('error', (e) => {
      reject(e);
    }).end();
  });
}

function updateAnnouncements(store: Redux.Store<IState>): Promise<void> {
  return getHTTPData<IAnnouncement>(ANNOUNCEMENT_LINK).then((res) => {
    store.dispatch(setAnnouncements(res));
    return Promise.resolve();
  })
  .catch(err => log('warn', 'failed to retrieve list of announcements', err));
}

function updateSurveys(store: Redux.Store<IState>) {
  return ((DEBUG_MODE)
    ? readLocalSurveysFile()
    : getHTTPData<ISurveyInstance>(SURVEYS_LINK)).then((res) => {
      store.dispatch(setAvailableSurveys(res));
      return Promise.resolve();
  })
  .catch(err => log('warn', 'failed to retrieve list of surveys', err));
}

function init(context: IExtensionContext): boolean {
  context.registerDashlet('Announcements', 1, 3, 200, AnnouncementDashlet,
    (state: IState) => true,
  () => ({}), { closable: true });

  context.registerReducer(['session', 'announcements'], sessionReducer);
  context.registerReducer(['session', 'surveys'], surveySessionReducer);
  context.registerReducer(['persistent', 'surveys'], persistentReducer);

  context.once(() => {
    const store = context.api.store;
    if (store.getState().session.base.networkConnected) {
      updateSurveys(store);
      updateAnnouncements(store);
    }
  });

  return true;
}

export default init;
