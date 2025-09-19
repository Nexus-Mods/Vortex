/// <reference types="node" />
import runElevated from './elevated';
import runThreaded from './thread';
declare const dynreq: NodeJS.Require;
export { runElevated, runThreaded, dynreq };
