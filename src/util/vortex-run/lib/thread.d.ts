import Bluebird from 'bluebird';
declare function runThreaded(func: (...args: any[]) => any, moduleBase: string, ...args: any[]): Bluebird<any>;
export default runThreaded;
