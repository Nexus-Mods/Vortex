import { IMod } from './IMod';
import * as Promise from 'bluebird';

export interface IModActivator {

  /**
   * id of the activator for lookup in code
   * 
   * @type {string}
   * @memberOf IModActivator
   */
  id: string;

  /**
   * name of this activator as presented to the user
   * 
   * @type {string}
   * @memberOf IModActivator
   */
  name: string;

  /**
   * Short description of the activator and it's pros/cons
   * 
   * @type {string}
   * @memberOf IModActivator
   */
  description: string;

  /**
   * determine if this activator is supported in the current environment
   * 
   * synchronous 'cause lazy.
   * 
   * @memberOf IModActivator
   */
  isSupported: (state: any) => boolean;

  /**
   * called before any calls to activate, in case the
   * activator needs to do pre-processing
   * 
   * @memberOf IModActivator
   */
  prepare: (modsPath: string) => Promise<void>;

  /**
   * called after an activate call was made for all active mods,
   * in case this activator needs to do postprocessing
   * 
   * @memberOf IModActivator
   */
  finalize: (modsPath: string) => Promise<void>;

  /**
   * activate the specified mod in the specified location
   * 
   * @memberOf IModActivator
   */
  activate: (modsPath: string, mod: IMod) => Promise<void>;

  /**
   * deactivate all mods at the destination location
   * NMM2 itself does not keep track which files were installed by the
   * activator so if the activator can not discover those automatically it
   * it has to do its own bookkeeping 
   * 
   * @memberOf IModActivator
   */
  deactivate: (modsPath: string) => Promise<void>;

  /**
   * returns whether this mod activator currently has mods activated in the
   * game directory
   * 
   * @memberOf IModActivator
   */
  isActive: () => boolean;
}
