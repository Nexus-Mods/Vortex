import { IExtensionApi, ILookupResult } from '../../../types/IExtensionContext';
import { batchDispatch } from '../../../util/util';
import { setDownloadModInfo } from '../../download_management/actions/state';
import { setModAttribute } from '../../mod_management/actions/mods';
import { IMod } from '../../mod_management/types/IMod';
import modName from '../../mod_management/util/modName';
import NXMUrl from '../NXMUrl';

import Bluebird from 'bluebird';
import * as path from 'path';

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
  return api.showDialog('question', 'Multiple results', {
    text: 'There are multiple potential matches. This usually happens when the same file '
        + 'has been uploaded multiple times. If possible, please select the one you actually '
        + 'downloaded.',
    choices: lookupResult.map(iter => iter.value).map((result, idx) => ({
      id: idx.toString(),
      text: t('{{fileName}} (Version {{version}}) (Mod {{modId}}, File {{fileId}})', { replace: {
        fileName: result.fileName,
        version: result.fileVersion,
        modId: result.details.modId,
        fileId: result.details.fileId,
      } }),
      value: idx === 0,
    })),
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
  return api.lookupModMeta({
    fileMD5: mod.attributes?.fileMD5,
    fileName,
    fileSize: mod.attributes?.fileSize,
    filePath: path.join(downloadPath, fileName),
  }, true)
    .then(lookupResults => {
      const applicable = lookupResults.filter(iter => !!iter.value.sourceURI);
      if (applicable.length > 0) {
        const idxProm = (applicable.length === 1)
          ? Bluebird.resolve(0)
          : queryLookupResult(api, applicable);

        return idxProm
          .then(idx => {
            const info = lookupResults[idx].value;
            const nxmUrl = new NXMUrl(info.sourceURI);
            if (mod.state === 'installed') {
              batchDispatch(api.store, [
                setModAttribute(gameId, mod.id, 'modId', nxmUrl.modId),
                setModAttribute(gameId, mod.id, 'fileId', nxmUrl.fileId),
              ]);
            }
            if (hasArchive) {
              batchDispatch(api.store, [
                setDownloadModInfo(mod.archiveId, 'nexus.ids.modId', nxmUrl.modId),
                setDownloadModInfo(mod.archiveId, 'nexus.ids.fileId', nxmUrl.fileId),
              ]);
            }
          })
          .catch(err => api.showErrorNotification('Failed to update mod ids', err));
      } else {
        return queryResetSource(api, gameId, mod);
      }
    });
}
