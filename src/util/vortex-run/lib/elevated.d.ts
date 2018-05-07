/// <reference types="bluebird" />
import * as Promise from 'bluebird';
/**
 * run a function as an elevated process (windows only!).
 * This is quite a hack because obviously windows doesn't allow us to elevate a
 * running process so instead we have to store the function code into a file and start a
 * new node process elevated to execute that script.
 * Through some hackery the base path for relative requires can be set.
 *
 * IMPORTANT As a consequence the function can not bind any parameters
 *
 * @param {string} ipcPath a unique identifier for a local ipc channel that can be used to
 *                 communicate with the elevated process (as stdin/stdout can not be)
 *                 redirected
 * @param {Function} func The closure to run in the elevated process. Try to avoid
 *                        'fancy' code.
 * @param {Object} args arguments to be passed into the elevated process
 * @param {string} moduleBase base directory for all relative require call. If undefined,
 *                 the directory of this very file (elevated.js) will be used.
 * @returns {Promise<any>} a promise that will be resolved as soon as the process is started
 *                         (which happens after the user confirmed elevation)
 */
declare function runElevated(ipcPath: string, func: (ipc: any) => void, args?: any, moduleBase?: string): Promise<any>;
export default runElevated;
