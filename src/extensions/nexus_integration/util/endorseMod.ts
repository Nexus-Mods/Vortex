import NexusT from '@nexusmods/nexus-api';
import Promise from 'bluebird';

/**
 * endorse the mod by the server call
 *
 * @param {string} activeGameId
 * @param {NexusT} nexus
 * @param {string} endorseStatus
 * @param {string} modId,
 * @return {boolean} isEndorsed
 *
 */

function endorseMod(nexus: NexusT, gameId: string, nexusModId: number,
                    version: string, endorseStatus: string): Promise<string> {
  if (endorseStatus === 'Undecided' || endorseStatus === 'Abstained' ||
      endorseStatus === '') {
    endorseStatus = 'endorse';
  } else if (endorseStatus === 'Endorsed') {
    endorseStatus = 'abstain';
  }

  return Promise.resolve(nexus.endorseMod(nexusModId, version, endorseStatus as any, gameId))
      .then(result => result.status);
}

export default endorseMod;
