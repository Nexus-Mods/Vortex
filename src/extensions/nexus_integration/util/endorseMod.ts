import Nexus from 'nexus-api';

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
