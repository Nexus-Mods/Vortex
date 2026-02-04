import { setChangelogs } from "./actions";
import ChangelogDashlet from "./ChangelogDashlet";
import sessionReducer from "./reducers";

import Promise from "bluebird";
import * as _ from "lodash";
import * as path from "path";
import * as Redux from "redux";
import * as semver from "semver";
import { log, types, util } from "vortex-api";
import { Changelog } from "./types";

function updateReleases(store: Redux.Store<types.IState>): Promise<void> {
  const state: types.IState = store.getState();
  const persistentLogs: Array<Changelog> = util.getSafe(
    state,
    ["persistent", "changelogs", "changelogs"],
    [],
  );

  // if changelogs are found in the state, we force sort and then update state, just in case this is the first time
  if (persistentLogs.length !== 0) {
    const copiedChangelogs = Array.from(persistentLogs);

    // sort
    const sortedChangelogs = copiedChangelogs.sort((a, b) =>
      semver.compare(b.version, a.version),
    );

    // update state
    store.dispatch(setChangelogs(sortedChangelogs));
  }

  if (!(store.getState().session.base as any).networkConnected) {
    return Promise.resolve();
  }
  return util.github.releases().then((releases) => {
    // if we have an update from github, then process it and update state

    const len = releases.length;

    //if ((persistentLogs.length !== len)  || (persistentLogs[len - 1].version !== releases[len - 1].name)) {

    const changeLogs = releases.map((rel) => ({
      version: rel.name,
      text: rel.body,
      prerelease: rel.prerelease,
    }));

    const copiedChangelogsArray = Array.from(changeLogs);

    const sortedChangelogs = copiedChangelogsArray.sort((a, b) =>
      semver.compare(b.version, a.version),
    );
    store.dispatch(setChangelogs(sortedChangelogs));
    //}
  });
}

function main(context: types.IExtensionContext) {
  // We store changelogs persistently, so even on a rare edge case
  //  where the user has exceeded his GitHub rate limit (shouldn't be possible)
  //  we still have data to display.
  context.registerReducer(["persistent", "changelogs"], sessionReducer);

  context.registerDashlet(
    "Changelog",
    1,
    3,
    200,
    ChangelogDashlet,
    (state: types.IState) => true,
    () => ({}),
    { closable: true },
  );

  context.once(() => {
    context.api.setStylesheet(
      "changelog",
      path.join(__dirname, "changelog.scss"),
    );
    updateReleases(context.api.store).catch((err) => {
      log("warn", "failed to retrieve list of releases", err.message);
    });
  });

  return true;
}

export default main;
