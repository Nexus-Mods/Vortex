import program = require('commander');
import { app } from 'electron';

export interface IParameters {
  download?: string;
  report?: string;
}

function parseCommandline(argv: string[]): IParameters {
  return program
    .version(app.getVersion())
    .option('-d, --download [url]', 'Start downloadling the specified url.')
    .option('--report [path]', 'Send an error report. For internal use')
    .parse(argv) as IParameters;
}

export default parseCommandline;
