import program = require('commander');
import { app } from 'electron';

export interface IParameters {
  download?: string;
  report?: string;
  wait?: boolean;
  get?: string;
  set?: string[];
}

function assign(input: string): string[] {
  return input.split('=');
}

function parseCommandline(argv: string[]): IParameters {
  if (!argv[0].includes('electron.exe')) {
    argv = ['dummy'].concat(argv);
  }
  return program
    .command('Vortex')
    .version(app.getVersion())
    .option('-d, --download [url]', 'Start downloadling the specified url.')
    .option('-g, --get [path]', 'Print the state variable at the specified path and quit. '
                              + 'For debugging')
    .option('-s, --set [path]=[value]', 'Change a value in the state. Please be very careful '
                                      + 'with this, incorrect use will break Vortex and you may '
                                      + 'lose data', assign)
    .option('--wait', 'If another instance of Vortex is running, wait for it to end.')
    .option('--report [path]', 'Send an error report. For internal use')
    // allow unknown options since they may be interpreted by electron/node
    .allowUnknownOption()
    .parse(argv || []) as IParameters;
}

export default parseCommandline;
