import * as os from 'os';
import * as path from 'path';
import { IExtensionContext, IRunParameters } from '../../types/IExtensionContext';
import { IProfile, IState } from '../../types/IState';
import getVortexPath from '../../util/getVortexPath';
import { log } from '../../util/log';
import { activeProfile } from '../../util/selectors';

function init(context: IExtensionContext): boolean {
  context.registerToolVariables((parameters: IRunParameters) => {
    const { env } = parameters.options;
    const state: IState = context.api.getState();
    const profile: IProfile = activeProfile(state);

    if (profile === undefined) {
      log('warn', 'starting a tool with no active profile? How?', { parameters });
      // not really the job of this extension to report this to the use
    }

    let res: any = {
      ...Object.keys(env).reduce((prev, key) => ({ ...prev, [key.toUpperCase()]: env[key] }), {}),
      APPDATA: getVortexPath('appData'),
      HOME: os.homedir(),
    };

    if (profile !== undefined) {
      res = {
        ...res,
        PROFILE_ID: profile.id,
        PROFILE_NAME: profile.name,
        PROFILE_PATH: path.join(getVortexPath('userData'), profile.gameId, 'profiles', profile.id),
      };
    }

    return res;
  });

  return true;
}

export default init;
