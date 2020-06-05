/// <reference types="node" />
/// <reference types="jest" />
/// <reference types="webpack-env" />
import runElevated from './elevated';
import runThreaded from './thread';
declare const dynreq: NodeRequire;
export { runElevated, runThreaded, dynreq };
