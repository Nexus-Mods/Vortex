import * as Promise from 'bluebird';

/**
 * static information about a tool associated with the game.
 * This info is used to discover such tools and to store that
 * data after discovery
 * 
 * @export
 * @interface ISupportedTool
 */
export interface ISupportedTool {
  id: string;
  name?: string;
  logo?: string;
  location?: () => string | Promise<string>;
  path?: string;
  hidden?: boolean;
  parameters?: string;
  custom?: boolean;
}
