import Bluebird from "bluebird";
import * as https from "https";
import * as _ from "lodash";
import * as path from "path";
import type * as Redux from "redux";
import * as url from "url";

import { addNotification } from "../../actions/notifications";
import type {
  IExtensionContext,
  ThunkStore,
} from "../../types/IExtensionContext";
import type { IState } from "../../types/IState";
import { getApplication } from "../../util/application";
import { DataInvalid } from "../../util/CustomErrors";
import * as fs from "../../util/fs";
import getVortexPath from "../../util/getVortexPath";
import { log } from "../../util/log";
import opn from "../../util/opn";
import { activeGameId } from "../../util/selectors";
import { getSafe } from "../../util/storeHelper";

import sessionReducer from "./reducers/announcements";
import persistentReducer from "./reducers/persistent";
import surveySessionReducer from "./reducers/surveys";

import {
  setAnnouncements,
  setAvailableSurveys,
  setSuppressSurvey,
} from "./actions";
import AnnouncementDashlet from "./AnnouncementDashlet";
import type { IAnnouncement, ISurveyInstance } from "./types";
import { ParserError } from "./types";

import { matchesGameMode, matchesVersion } from "./util";
import { getErrorMessageOrDefault } from "@vortex/shared";

const ANNOUNCEMENT_LINK =
  "https://raw.githubusercontent.com/Nexus-Mods/Vortex-Backend/main/out/announcements.json";

const SURVEYS_LINK =
  "https://raw.githubusercontent.com/Nexus-Mods/Vortex-Backend/main/out/surveys.json";

// Can be used for debugging.
const DEBUG_MODE: boolean = false;
const SURVEYS_LOCAL_PATH = path.join(__dirname, "surveys.json");

function readLocalSurveysFile() {
  return fs.readFileAsync(SURVEYS_LOCAL_PATH).then((data) => {
    try {
      const parsed: ISurveyInstance[] = JSON.parse(data);
      return Bluebird.resolve(parsed);
    } catch (err) {
      return Bluebird.reject(err);
    }
  });
}

function getHTTPData<T>(link: string): Bluebird<T[]> {
  let sanitizedURL;
  try {
    sanitizedURL = new URL(link);
  } catch (err) {
    return Bluebird.reject(new Error(`Invalid URL: ${link}`));
  }
  log("info", "getHTTPData", sanitizedURL);
  return new Bluebird((resolve, reject) => {
    https
      .get(sanitizedURL.href, (res) => {
        res.setEncoding("utf-8");
        let output = "";
        res
          .on("data", (data) => (output += data))
          .on("end", () => {
            try {
              const parsed: T[] = JSON.parse(output);
              resolve(parsed);
            } catch (err) {
              reject(
                new ParserError(
                  res.statusCode,
                  getErrorMessageOrDefault(err),
                  link,
                  output,
                ),
              );
            }
          });
      })
      .on("error", (e) => {
        reject(e);
      })
      .end();
  });
}

async function updateAnnouncements(store: ThunkStore<IState>) {
  try {
    let res: IAnnouncement[];
    if (process.env.NODE_ENV === "development") {
      try {
        res = JSON.parse(
          await fs.readFileAsync(
            path.join(getVortexPath("temp"), "announcements.json"),
            { encoding: "utf8" },
          ),
        );
        store.dispatch(
          addNotification({
            type: "info",
            message: "Using announcements from file.",
          }),
        );
      } catch (err) {
        // nop
      }
    }
    if (res === undefined) {
      res = await getHTTPData<IAnnouncement>(ANNOUNCEMENT_LINK);
    }
    log("info", "retrieved list of announcements", res);
    store.dispatch(setAnnouncements(res));
  } catch (err) {
    log("warn", "failed to retrieve list of announcements", err);
  }
  return Bluebird.resolve();
}

function updateSurveys(store: Redux.Store<IState>) {
  return (
    DEBUG_MODE
      ? readLocalSurveysFile()
      : getHTTPData<ISurveyInstance>(SURVEYS_LINK)
  )
    .then((res) => {
      if (!Array.isArray(res)) {
        return Bluebird.reject(
          new DataInvalid(`expected array but got ${typeof res} instead`),
        );
      }

      // Ugly but needed.
      const validSurveys = res.filter(
        (iter) => !!iter.endDate && !!iter.id && !!iter.link,
      );

      if (validSurveys.length !== res.length) {
        log("debug", "survey array contains invalid survey instances");
      }

      store.dispatch(setAvailableSurveys(validSurveys));
      return Bluebird.resolve();
    })
    .catch((err) => log("warn", "failed to retrieve list of surveys", err));
}

function init(context: IExtensionContext): boolean {
  context.registerReducer(["session", "announcements"], sessionReducer);
  context.registerReducer(["session", "surveys"], surveySessionReducer);
  context.registerReducer(["persistent", "surveys"], persistentReducer);

  context.registerDashlet(
    "Announcements",
    1,
    3,
    200,
    AnnouncementDashlet,
    (state: IState) => true,
    () => ({}),
    { closable: true },
  );

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
  const surveys = getSafe(state, ["session", "surveys", "available"], []);
  const suppressed = getSafe(
    state,
    ["persistent", "surveys", "suppressed"],
    {},
  );
  const gameMode = activeGameId(state);
  const suppressedIds = Object.keys(suppressed);
  const isOutdated = (survey: ISurveyInstance) => {
    const surveyCutoffDateMS = new Date(survey.endDate).getTime();
    return surveyCutoffDateMS <= now;
  };

  const appVersion = getApplication().version;

  const filtered = surveys.filter((survey) => {
    const isSuppressed =
      suppressedIds.includes(survey.id) && suppressed[survey.id] === true;
    return (
      !isSuppressed &&
      !isOutdated(survey) &&
      matchesGameMode(survey, gameMode, survey?.gamemode === undefined) &&
      matchesVersion(survey, appVersion)
    );
  });

  if (filtered.length > 0) {
    context.api.sendNotification({
      id: "survey-notification",
      type: "info",
      message: t("We could use your opinion on something..."),
      noDismiss: true,
      actions: [
        {
          title: "Go to Survey",
          action: (dismiss) => {
            const survey = filtered[0];
            opn(survey.link)
              .then(() =>
                context.api.store.dispatch(setSuppressSurvey(survey.id, true)),
              )
              .catch(() => null);
            dismiss();
          },
        },
        {
          title: "No thanks",
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
