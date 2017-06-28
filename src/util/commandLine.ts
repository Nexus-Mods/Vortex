import program = require('commander');
import { app } from 'electron';

export interface IParameters {
  download?: string;
  report?: string;
  wait?: boolean;
}

function parseCommandline(argv: string[]): IParameters {
  if (!argv[0].includes('electron.exe')) {
    argv = ['dummy'].concat(argv);
  }
  return program
    .command('Vortex')
    .version(app.getVersion())
    .option('-d, --download [url]', 'Start downloadling the specified url.')
    .option('--wait', 'If another instance of Vortex is running, wait for it to end.')
    .option('--report [path]', 'Send an error report. For internal use')
    .parse(argv || []) as IParameters;
}

export default parseCommandline;
