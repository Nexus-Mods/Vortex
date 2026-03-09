import * as https from 'https';
import * as _ from 'lodash';
import * as semver from 'semver';
import * as url from 'url';

import { GAME_ID, LSLIB_URL } from './common';

import { IncomingHttpHeaders, IncomingMessage } from 'http';
import { actions, log, selectors, types, util } from 'vortex-api';

const GITHUB_URL = 'https://api.github.com/repos/Norbyte/lslib';

function query(baseUrl: string, request: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const getRequest = getRequestOptions(`${baseUrl}/${request}`);
    https.get(getRequest, (res: IncomingMessage) => {
      res.setEncoding('utf-8');
      const msgHeaders: IncomingHttpHeaders = res.headers;
      const callsRemaining = parseInt(util.getSafe(msgHeaders, ['x-ratelimit-remaining'], '0'), 10);
      if ((res.statusCode === 403) && (callsRemaining === 0)) {
        const resetDate = parseInt(util.getSafe(msgHeaders, ['x-ratelimit-reset'], '0'), 10);
        log('info', 'GitHub rate limit exceeded',
          { reset_at: (new Date(resetDate)).toString() });
        return reject(new util.ProcessCanceled('GitHub rate limit exceeded'));
      }

      let output: string = '';
      res
        .on('data', data => output += data)
        .on('end', () => {
          try {
            return resolve(JSON.parse(output));
          } catch (parseErr) {
            return reject(parseErr);
          }
        });
    })
      .on('error', err => {
        return reject(err);
      })
      .end();
  });
}

function getRequestOptions(link) {
  const relUrl = url.parse(link);
  return ({
    ..._.pick(relUrl, ['port', 'hostname', 'path']),
    headers: {
      'User-Agent': 'Vortex',
    },
  });
}

async function downloadConsent(api: types.IExtensionApi): Promise<void> {
  return api.showDialog('error', 'Divine tool is missing', {
    bbcode: api.translate('Baldur\'s Gate 3\'s modding pattern in most (if not all) cases will require a 3rd '
      + 'party tool named "{{name}}" to manipulate game files.[br][/br][br][/br]'
      + 'Vortex can download and install this tool for you as a mod entry. Please ensure that the '
      + 'tool is always enabled and deployed on the mods page.[br][/br][br][/br]'
      + 'Please note that some Anti-Virus software may flag this tool as malicious due '
      + 'to the nature of the tool (unpacks .pak files). We suggest you ensure that '
      + 'your security software is configured to allow this tool to install.', { replace: { name: 'LSLib' } }),
  }, [
    { label: 'Cancel' },
    { label: 'Download' },
  ])
  .then(result => (result.action === 'Cancel')
    ? Promise.reject(new util.UserCanceled())
    : Promise.resolve());
}

async function notifyUpdate(api: types.IExtensionApi, latest: string, current: string): Promise<void> {
  const gameId = selectors.activeGameId(api.store.getState());
  const t = api.translate;
  return new Promise((resolve, reject) => {
    api.sendNotification({
      type: 'info',
      id: `divine-update`,
      noDismiss: true,
      allowSuppress: true,
      title: 'Update for {{name}}',
      message: 'Latest: {{latest}}, Installed: {{current}}',
      replace: {
        latest,
        current,
      },
      actions: [
        { title : 'More', action: (dismiss: () => void) => {
            api.showDialog('info', '{{name}} Update', {
              text: 'Vortex has detected a newer version of {{name}} ({{latest}}) available to download from {{website}}. You currently have version {{current}} installed.'
              + '\nVortex can download and attempt to install the new update for you.',
              parameters: {
                name: 'LSLib/Divine Tool',
                website: LSLIB_URL,
                latest,
                current,
              },
            }, [
                {
                  label: 'Download',
                  action: () => {
                    resolve();
                    dismiss();
                  },
                },
              ]);
          },
        },
        {
          title: 'Dismiss',
          action: (dismiss) => {
            resolve();
            dismiss();
          },
        },
      ],
    });
  });
}

export async function getLatestReleases(currentVersion: string) {
  if (GITHUB_URL) {
    return query(GITHUB_URL, 'releases')
    .then((releases) => {
      if (!Array.isArray(releases)) {
        return Promise.reject(new util.DataInvalid('expected array of github releases'));
      }
      const current = releases
        .filter(rel => {
          const tagName = util.getSafe(rel, ['tag_name'], undefined);
          const isPreRelease = util.getSafe(rel, ['prerelease'], false);
          const version = semver.valid(tagName);

          return (!isPreRelease
            && (version !== null)
            && ((currentVersion === undefined) || (semver.gte(version, currentVersion))));
        })
        .sort((lhs, rhs) => semver.compare(rhs.tag_name, lhs.tag_name));

      return Promise.resolve(current);
    });
  }
}

async function startDownload(api: types.IExtensionApi, downloadLink: string) {
  // tslint:disable-next-line: no-shadowed-variable - why is this even required ?
  const redirectionURL = await new Promise((resolve, reject) => {
    https.request(getRequestOptions(downloadLink), res => {
      return resolve(res.headers['location']);
    })
      .on('error', err => reject(err))
      .end();
  });
  const dlInfo = {
    game: GAME_ID,
    name: 'LSLib/Divine Tool',
  };
  api.events.emit('start-download', [redirectionURL], dlInfo, undefined,
    (error, id) => {
      if (error !== null) {
        if ((error.name === 'AlreadyDownloaded')
            && (error.downloadId !== undefined)) {
          id = error.downloadId;
        } else {
          api.showErrorNotification('Download failed',
            error, { allowReport: false });
          return Promise.resolve();
        }
      }
      api.events.emit('start-install-download', id, true, (err, modId) => {
        if (err !== null) {
          api.showErrorNotification('Failed to install LSLib',
            err, { allowReport: false });
        }

        const state = api.getState();
        const profileId = selectors.lastActiveProfileForGame(state, GAME_ID);
        api.store.dispatch(actions.setModEnabled(profileId, modId, true));
        return Promise.resolve();
      });
    }, 'ask');
}

async function resolveDownloadLink(currentReleases: any[]) {
  const archives = currentReleases[0].assets.filter(asset =>
    asset.name.match(/(ExportTool-v[0-9]+.[0-9]+.[0-9]+.zip)/i));

  const downloadLink = archives[0]?.browser_download_url;
  return (downloadLink === undefined)
    ? Promise.reject(new util.DataInvalid('Failed to resolve browser download url'))
    : Promise.resolve(downloadLink);
}

export async function checkForUpdates(api: types.IExtensionApi,
                                      currentVersion: string): Promise<string> {
  return getLatestReleases(currentVersion)
    .then(async currentReleases => {
      if (currentReleases[0] === undefined) {
        // We failed to check for updates - that's unfortunate but shouldn't
        //  be reported to the user as it will just confuse them.
        log('error', 'Unable to update LSLib', 'Failed to find any releases');
        return Promise.resolve(currentVersion);
      }
      const mostRecentVersion = currentReleases[0].tag_name.slice(1);
      const downloadLink = await resolveDownloadLink(currentReleases);
      if (semver.valid(mostRecentVersion) === null) {
        return Promise.resolve(currentVersion);
      } else {
        if (semver.gt(mostRecentVersion, currentVersion)) {
          return notifyUpdate(api, mostRecentVersion, currentVersion)
            .then(() => startDownload(api, downloadLink))
            .then(() => Promise.resolve(mostRecentVersion));
        } else {
          return Promise.resolve(currentVersion);
        }
      }
    }).catch(err => {
      if (err instanceof util.UserCanceled || err instanceof util.ProcessCanceled) {
        return Promise.resolve(currentVersion);
      }

      api.showErrorNotification('Unable to update LSLib', err);
      return Promise.resolve(currentVersion);
    });
}

export async function downloadDivine(api: types.IExtensionApi): Promise<void> {
  const state = api.store.getState();
  const gameId = selectors.activeGameId(state);
  return getLatestReleases(undefined)
    .then(async currentReleases => {
      const downloadLink = await resolveDownloadLink(currentReleases);
      return downloadConsent(api)
        .then(() => startDownload(api, downloadLink));
    })
    .catch(err => {
      if (err instanceof util.UserCanceled || err instanceof util.ProcessCanceled) {
        return Promise.resolve();
      } else {
        api.showErrorNotification('Unable to download/install LSLib', err);
        return Promise.resolve();
      }
    });
}
