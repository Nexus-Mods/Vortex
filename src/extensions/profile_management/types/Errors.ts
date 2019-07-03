import { IProfile } from './IProfile';

export class CorruptActiveProfile extends Error {
  constructor(profile: IProfile) {
    super('The active profile is corrupted, please create a new one.\n'
        + `Profile: ${JSON.stringify(profile)}`);
  }
}
