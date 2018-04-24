/// <reference types="bluebird" />
import * as Promise from 'bluebird';
declare function runThreaded(func: (...args: any[]) => any, moduleBase: string, ...args: any[]): Promise<any>;
export default runThreaded;
