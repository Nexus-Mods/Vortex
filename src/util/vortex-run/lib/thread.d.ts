// TODO: Remove Bluebird import - using native Promise;
declare function runThreaded(func: (...args: any[]) => any, moduleBase: string, ...args: any[]): Promise<any>;
export default runThreaded;
