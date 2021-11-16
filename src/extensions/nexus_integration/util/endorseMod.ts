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
  endorseStatus = endorseStatus.toLowerCase();
  if (endorseStatus === 'undecided' || endorseStatus === 'abstained' ||
      endorseStatus === '') {
    endorseStatus = 'endorse';
  } else if (endorseStatus === 'endorsed') {
    endorseStatus = 'abstain';
  }

  return Promise.resolve(nexus.endorseMod(nexusModId, version, endorseStatus as any, gameId))
      .then(result => result.status);
}

function endorseCollection(nexus: NexusT, gameId: string, collectionId: number,
                           endorseStatus: string) {
  endorseStatus = endorseStatus.toLowerCase();
  if ((endorseStatus === 'undecided') || (endorseStatus === 'abstained') ||
      (endorseStatus === '')) {
    endorseStatus = 'endorse';
  } else if (endorseStatus === 'endorsed') {
    endorseStatus = 'abstain';
  }

  return Promise.resolve(nexus.endorseCollection(collectionId, endorseStatus as any, gameId));
}

export { endorseCollection, endorseMod };
