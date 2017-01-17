import Nexus from 'nexus-api';

/**
 * endorse the mod by the server call
 * 
 * @param {string} activeGameId
 * @param {Nexus} nexus
 * @param {boolean} isEndorsed
 * @param {string} modId,
 * @return {boolean} isEndorsed
 * 
 */

function retrieveEndorsedMod(
  activeGameId: string,
  nexus: Nexus,
  isEndorsed: boolean,
  modId: string,
): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    // TODO LUCO Tom's call
    resolve(!isEndorsed);
  });
}

export default retrieveEndorsedMod;
