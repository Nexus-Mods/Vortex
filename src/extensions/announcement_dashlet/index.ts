import Promise from 'bluebird';
import { remote } from 'electron';
import * as https from 'https';
import * as _ from 'lodash';
import * as path from 'path';
import * as Redux from 'redux';
import * as url from 'url';

import { IExtensionContext } from '../../types/IExtensionContext';
import { IState } from '../../types/IState';
import * as fs from '../../util/fs';
import { log } from '../../util/log';
import opn from '../../util/opn';
import { activeGameId } from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';

import sessionReducer from './reducers/announcements';
import persistentReducer from './reducers/persistent';
import surveySessionReducer from './reducers/surveys';

import { setAnnouncements, setAvailableSurveys, setSuppressSurvey } from './actions';
import AnnouncementDashlet from './AnnouncementDashlet';
import { IAnnouncement, ISurveyInstance,
  ParserError } from './types';

import { matchesGameMode, matchesVersion } from './util';

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
      updateSurveys(store).then(() => showSurveyNotification(context));
      updateAnnouncements(store);
    }
  });

  return true;
}

function showSurveyNotification(context) {
  const t = context.api.translate;
  const state = context.api.store.getState();
  const now = new Date().getTime();
  const surveys = getSafe(state, ['session', 'surveys', 'available'], []);
  const suppressed = getSafe(state, ['persistent', 'surveys', 'suppressed'], {});
  const gameMode = activeGameId(state);
  const suppressedIds = Object.keys(suppressed);
  const isOutdated = (survey: ISurveyInstance) => {
    const surveyCutoffDateMS = new Date(survey.endDate).getTime();
    return surveyCutoffDateMS <= now;
  };

  const appVersion = remote.app.getVersion();

  const filtered = surveys.filter(survey => {
    const isSuppressed = (suppressedIds.includes(survey.id) && (suppressed[survey.id] === true));
    return !isSuppressed
        && !isOutdated(survey)
        && matchesGameMode(survey, gameMode, (survey?.gamemode === undefined))
        && matchesVersion(survey, appVersion);
  });

  if (filtered.length > 0) {
      context.api.sendNotification({
      id: 'survey-notification',
      type: 'info',
      message: t('We could use your opinion on something...'),
      noDismiss: true,
      actions: [
        {
          title: 'Go to Survey',
          action: (dismiss) => {
            const survey = filtered[0];
            opn(survey.link)
              .then(() => context.api.store.dispatch(setSuppressSurvey(survey.id, true)))
              .catch(() => null);
            dismiss();
          },
        },
        {
          title: 'No thanks',
          action: (dismiss) => {
            const survey = filtered[0];
            context.api.store.dispatch(setSuppressSurvey(survey.id, true));
            dismiss();
          },
        },
      ],
    });
  }
}

export default init;
