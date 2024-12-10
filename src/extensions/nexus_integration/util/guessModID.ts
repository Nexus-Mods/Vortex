/* eslint-disable */
import { IExtensionApi, ILookupResult, IModInfo } from '../../../types/IExtensionContext';
import { ProcessCanceled } from '../../../util/CustomErrors';
import { batchDispatch, truthy } from '../../../util/util';
import { setDownloadModInfo } from '../../download_management/actions/state';
import { getGame } from '../../gamemode_management/util/getGame';
import { setModAttribute } from '../../mod_management/actions/mods';
import { IMod } from '../../mod_management/types/IMod';
import modName from '../../mod_management/util/modName';
import { activeGameId } from '../../profile_management/selectors';
import NXMUrl from '../NXMUrl';

import Bluebird from 'bluebird';
import * as path from 'path';
import { toNXMId } from './convertGameId';
import { gameById } from '../../gamemode_management/selectors';
import { SITE_ID } from '../../gamemode_management/constants';

export function guessFromFileName(fileName: string): string {
  const match = fileName.match(/-([0-9]+)-/);
  if (match !== null) {
    return match[1];
  } else {
    return undefined;
  }
}

export function queryLookupResult(api: IExtensionApi,
                                  lookupResult: ILookupResult[])
                                  : Bluebird<number> {
  const t = api.translate;
  const gameMode = activeGameId(api.getState());

  let hasRefs = false;

  const choices = lookupResult.map(iter => iter.value).map((result, idx) => {
    // this might be a game we don't support, in which case we won't be able to show
    // a user-friendly name
    const game = getGame(result.gameId);
    const refs: string[] = [];
    if (gameMode !== result.gameId) {
      hasRefs = true;
      refs.push('(wrong game)');
    }
    if (result.status === 'revoked') {
      hasRefs = true;
      refs.push('(deleted)');
    }

    const sp = (refs.length > 0) ? ' ' : '';

    return {
      id: idx.toString(),
      text: refs.join(', ') + sp
        + t('{{fileName}} (Version {{version}}) ({{game}}, Mod {{modId}}, File {{fileId}})', {
        replace: {
          fileName: result.fileName,
          version: result.fileVersion,
          modId: result.details.modId,
          fileId: result.details.fileId,
          game: (game !== undefined) ? (game.shortName || game.name) : result.gameId,
        },
      }),
      value: idx === 0,
    };
  });

  let text = 'There are multiple potential matches. This usually happens when the same file '
        + 'has been uploaded multiple times. If possible, please select the one you actually '
        + 'downloaded.';

  if (hasRefs) {
    text += '\n\n(wrong game) This result is for a different game than you\'re managing. '
          + 'If necessary the archive for this mod will be moved to the directory '
          + 'for that game.'
          + '\n(deleted) This mod has been removed from the site, you can use this meta information '
          + 'for descriptions and such but the file can\'t be downloaded with this info '
          + 'so you won\'t be able to include it in collections for example.';
  }

  return api.showDialog('question', 'Multiple results', {
    text,
    choices,
  }, [
    { label: 'Continue' },
  ])
  .then(result => {
    return Object.keys(result.input).findIndex(iter => result.input[iter]);
  });
}

export function queryResetSource(api: IExtensionApi, gameId: string, mod: IMod) {
  const t = api.translate;
  return api.showDialog('info', '"{{modName}}" not found', {
      text: 'This mod wasn\'t found on the Nexus Mods servers, maybe it was modified? '
          + 'To avoid warnings going forward you may want to change the "source" for '
          + 'this mod so Vortex doesn\'t treat it as a Nexus Mods mod any more.',
      options: {
        translated: true,
      },
      parameters: {
        modName: modName(mod),
      },
    }, [
      { label: 'Cancel' },
      { label: 'Reset source' },
    ])
    .then(result => {
      if (result.action !== 'Cancel') {
        api.store.dispatch(setModAttribute(gameId, mod.id, 'source', 'unsupported'));
      }
    });
}

export function fillNexusIdByMD5(api: IExtensionApi,
                                 gameId: string,
                                 mod: IMod,
                                 fileName: string,
                                 downloadPath: string,
                                 hasArchive: boolean)
                                 : Bluebird<void> {
  const hasValidIds = truthy(mod?.attributes?.modId) && truthy(mod?.attributes?.fileId);
  const isNewestVersion = hasValidIds && (mod?.attributes?.newestFileId === mod?.attributes?.fileId);
  // We're not using the gameId in the query intentionally as we can't
  //  determine the game based on fileNames of locally imported archives.
  return api.lookupModMeta({
    fileMD5: mod.attributes?.fileMD5,
    fileName,
    fileSize: mod.attributes?.fileSize,
    filePath: path.join(downloadPath, fileName),
  }, true)
    .then(lookupResults => {
      const applicable = lookupResults.reduce((acc, iter) => {
        const hasUri = truthy(iter.value.sourceURI);
        const hasMd5Match = iter.value.fileMD5 === mod?.attributes?.fileMD5;
        if (!hasUri && hasMd5Match && hasValidIds) {
          // We know this is the mod; we just don't have the URI for it.
          const game = iter.value.gameId === SITE_ID ? null : gameById(api.store.getState(), gameId);
          if (!game) {
            return acc;
          }
          const url = `nxm://${toNXMId(game, iter.value.gameId)}/mods/${mod.attributes.modId}/files/${mod.attributes.fileId}`;
          acc.push({ ...iter, value: { ...iter.value, sourceURI: url } });
        } else if (hasUri) {
          acc.push(iter);
        }
        return acc;
      }, []);
      if (applicable.length > 0) {
        const idxProm = (applicable.length === 1)
          ? Bluebird.resolve(0)
          : queryLookupResult(api, applicable);

        return idxProm
          .then(async idx => {
            const info: IModInfo = lookupResults[idx].value;
            if (!info.sourceURI) {
              // find the applicable entry and use that one as source uri
              info.sourceURI = applicable.find(iter => iter.key === lookupResults[idx].key)?.value?.sourceURI ?? lookupResults[idx].value.sourceURI;
            }
            try {
              if (!info.sourceURI) {
                throw new ProcessCanceled('no source uri');
              }
              const nxmUrl = new NXMUrl(info.sourceURI);
              if (mod.state === 'installed') {
                const batched = [
                  setModAttribute(gameId, mod.id, 'modId', nxmUrl.modId),
                  setModAttribute(gameId, mod.id, 'fileId', nxmUrl.fileId),
                  setModAttribute(gameId, mod.id, 'downloadGame', info.gameId),
                ];
                // The only way for us to correctly assume the mod's version at this
                //  point, is if we managed to confirm that the installed mod is the latest fileId.
                if (isNewestVersion) {
                  batched.push(setModAttribute(gameId, mod.id, 'version', mod.attributes.newestVersion));
                } else {
                  // Let's try to guess the version from the filename and ask the user if it's correct.
                  const versionRgx = new RegExp(`${nxmUrl.modId}-(.*?)-\\d{10,}\\.(zip|rar|7z|tar|gz)$`, 'i');
                  const match = fileName.match(versionRgx);
                  if (match) {
                    // Group 1 will contain the version-like string
                    let version = match[1].trim();
                    version = version.replace(/\-/g, '.');
                    const t = api.translate;
                    const question = await api.showDialog('question', 'Mod version', {
                      bbcode: t('The version of this mod ("{{modName}}") is "{{version}}". Is this correct?[br][/br][br][/br]'
                              + 'If this is incorrect, you will have to manually enter the version number in the mod panel at a later time (if you wish).',
                              { replace: { version, modName: modName(mod) } }),
                    }, [
                      { label: 'Incorrect Version' },
                      { label: 'Correct Version', default: true },
                    ]);
                    if (question.action === 'Correct Version') {
                      batched.push(setModAttribute(gameId, mod.id, 'version', version));
                    }
                  }
                }
                batchDispatch(api.store, batched);
              }
              if (hasArchive) {
                batchDispatch(api.store, [
                  setDownloadModInfo(mod.archiveId, 'nexus.ids.modId', nxmUrl.modId),
                  setDownloadModInfo(mod.archiveId, 'nexus.ids.fileId', nxmUrl.fileId),
                ]);
              }
            } catch (err) {
              // don't use nxm info if parsing failed
            }

            if (hasArchive) {
              const downloads = api.getState().persistent.downloads.files;

              if (info.gameId !== downloads[mod.archiveId].game[0]) {
                return api.emitAndAwait('set-download-games', mod.archiveId,
                  [info.gameId, ...downloads[mod.archiveId].game]);
              }
            }
            return Promise.resolve();
          })
          .catch(err => api.showErrorNotification('Failed to update mod ids', err));
      } else {
        return queryResetSource(api, gameId, mod);
      }
    });
}
