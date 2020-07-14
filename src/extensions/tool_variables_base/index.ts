import * as os from 'os';
import * as path from 'path';
import { IExtensionContext, IRunParameters } from '../../types/IExtensionContext';
import { IProfile, IState } from '../../types/IState';
import getVortexPath from '../../util/getVortexPath';
import { activeProfile } from '../../util/selectors';

function init(context: IExtensionContext): boolean {
  context.registerToolVariables((parameters: IRunParameters) => {
    const { env } = parameters.options;
    const state: IState = context.api.getState();
    const profile: IProfile = activeProfile(state);

    return {
      ...Object.keys(env).reduce((prev, key) => ({ ...prev, [key.toUpperCase()]: env[key] }), {}),
      APPDATA: getVortexPath('appData'),
      HOME: os.homedir(),
      PROFILE_ID: profile.id,
      PROFILE_NAME: profile.name,
      PROFILE_PATH: path.join(getVortexPath('userData'), profile.gameId, 'profiles', profile.id),
    };
  });

  return true;
}

export default init;
