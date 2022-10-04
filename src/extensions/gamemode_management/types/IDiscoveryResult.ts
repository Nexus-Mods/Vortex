import { IDiscoveredTool } from '../../../types/IDiscoveredTool';

/**
 * describes parameters for the game set by the user
 * or discovered automatically.
 * There are essentially two blocks of fields here:
 * one is to identify the local installation of the game
 * the other to override defaults as provided by the
 * game extension. This is particularly relevant for
 * games added by the user.
 *
 * @export
 * @interface IDiscoveryResult
 */
export interface IDiscoveryResult {
  // base path of the game (NOT including the executable name)
  path?: string;
  pathSetManually?: boolean;
  store?: string;
  tools?: {
    [id: string]: IDiscoveredTool;
  };
  environment?: { [key: string]: string };

  hidden?: boolean;

  id?: string;
  name?: string;
  shortName?: string;
  executable?: string;
  parameters?: string[];
  logo?: string;
  extensionPath?: string;
  mergeMods?: boolean;
  shell?: boolean;
}
