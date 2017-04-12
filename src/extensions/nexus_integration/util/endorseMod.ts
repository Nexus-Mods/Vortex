import * as Promise from 'bluebird';
import Nexus from 'nexus-api';

/**
 * endorse the mod by the server call
 * 
 * @param {string} activeGameId
 * @param {Nexus} nexus
 * @param {string} endorseStatus
 * @param {string} modId,
 * @return {boolean} isEndorsed
 * 
 */

function endorseMod(nexus: Nexus, gameId: string, nexusModId: number,
                    version: string, endorseStatus: string): Promise<string> {
  if (endorseStatus === 'Undecided' || endorseStatus === 'Abstained' ||
      endorseStatus === '') {
    endorseStatus = 'endorse';
  } else if (endorseStatus === 'Endorsed') {
    endorseStatus = 'abstain';
  }

  return nexus.endorseMod(nexusModId, version, endorseStatus, gameId)
      .then(result => result.status);
}

export default endorseMod;
