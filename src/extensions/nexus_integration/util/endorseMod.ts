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

function retrieveEndorsedMod(
  nexus: Nexus,
  activeGameId: string,
  modId: string,
  version: string,
  endorseStatus: string,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {

    if (endorseStatus === 'Undecided' || endorseStatus === 'Abstained' || endorseStatus === '') {
      endorseStatus = 'endorse';
    } else  if (endorseStatus === 'Endorsed') {
      endorseStatus = 'abstain';
    }

    nexus.endorseMod(version, parseInt(modId, 10), endorseStatus, activeGameId)
      .then((result: any) => {
        resolve(result.status);
      })
      .catch((err) => {
        reject(err);
      });
  });
}

export default retrieveEndorsedMod;
