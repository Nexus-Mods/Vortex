import * as Promise from 'bluebird';

/**
 * static information about a tool associated with the game.
 * This info is used to discover such tools, the actual location
 * is stored in IToolDiscoveryResult
 * 
 * @export
 * @interface ISupportedTool
 */
export interface ISupportedTool {
  id: string;
  name: string;
  logo?: string;
  location: () => string | Promise<string>;
}
