import { IToolStored } from './IToolStored';

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
  path?: string;
  tools?: {
    [id: string]: IToolStored;
  };
  environment?: { [key: string]: string };

  hidden?: boolean;

  id?: string;
  name?: string;
  shortName?: string;
  executable?: string;
  logo?: string;
  extensionPath?: string;
  mergeMods?: boolean;
}
