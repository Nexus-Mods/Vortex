import runElevated, { Win32Error } from './elevated';
import runThreaded from './thread';

const dynreq = require;

export { runElevated, runThreaded, dynreq, Win32Error };
