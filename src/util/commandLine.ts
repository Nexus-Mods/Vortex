import program from 'commander';
import { app, ipcMain, ipcRenderer } from 'electron';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as process from 'process';
import { getApplication } from './application';
import { log } from './log';
import startupSettings from './startupSettings';

export interface IParameters {
  download?: string;
  install?: string;
  installExtension?: string;
  report?: string;
  restore?: string;
  startMinimized?: boolean;
  game?: string;
  profile?: string;
  get?: string;
  set?: string[];
  del?: string;
  merge?: string;
  run?: string;
  shared?: boolean;
  maxMemory?: string;
  disableGPU?: boolean;
  userData?: string;
  inspector?: boolean;
  storeVersion?: string;
}

function assign(input: string): string[] {
  return input.split('=');
}

const ARG_COUNTS = {
  '-d': 1,
  '-i': 1,
  '-g': 1,
  '-s': 1,
  '--download': 1,
  '--install': 1,
  '--install-extension': 1,
  '--start-minimized': 1,
  '--game': 1,
  '--profile': 1,
  '--get': 1,
  '--set': 1,
  '--del': 1,
  '--run': 1,
  '--report': 1,
  '--restore': 1,
  '--merge': 1,
  '--max-memory': 1,
  '--user-data': 1,
};

// Chrome rearranges the command line parameters it passes to processes it spawns internally
// by putting switches (--foo) first, arguments (bar) after.
// Which is fine in chrome because it's internal processes.
// The <insert insult here>s developing electron make this internal chrome behaviour part of
// their api, basically breaking all sensible user-facing clis:
// https://github.com/electron/electron/issues/20322
//
// Fortunately, looking at the code, at least chrome seems to keep the order of switches and
// arguments so since we don't have positional arguments and as long as we know which
// switches expect an argument and as long as the
// command line passed in is valid, we should be able to reconstruct it.
function electronIsShitArgumentSort(argv: string[]): string[] {
  const firstArgumentIdx = argv.findIndex((arg, idx) => (idx > 1) && !arg.startsWith('-'));
  const switches = argv.slice(1, firstArgumentIdx - 1);
  const args = argv.slice(firstArgumentIdx);
  let nextArg = 0;

  const res = [argv[0]];
  if (argv[0].includes('electron.exe')) {
    // did I say we have no positional arguments? Well, electron does...
    res.push(args[nextArg]);
    nextArg++;
  }

  switches.forEach(sw => {
    res.push(sw);
    const argCount = ARG_COUNTS[sw] || 0;
    res.push(...args.slice(nextArg, nextArg + argCount));
    nextArg += argCount;
  });

  // append all remaining arguments. This way if we do have positional arguments
  // after all, as long as they're at the end they will still work
  res.push(...args.slice(nextArg));

  return res;
}

export function addPreset(input: IParameters): IParameters {
  let result: IParameters = {};
  const presetPath = path.join(app.getPath('temp'), 'vortex_preset.json');
  try {
    const instructionsList: IParameters[] = JSON.parse(fs.readFileSync(presetPath, { encoding: 'utf-8' }));
    if (instructionsList.length > 0) {
      result = instructionsList.shift();
    }

    if (instructionsList.length === 0) {
      fs.removeSync(presetPath);
    } else {
      fs.writeFileSync(presetPath, JSON.stringify(instructionsList, undefined, 2), { encoding: 'utf-8' });
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      log('warn', 'failed to parse preset.json', { error: err.message });
      fs.removeSync(presetPath);
    }
  }

  return { ...input, ...result };
}

function parseCommandline(argv: string[], electronIsShitHack: boolean): IParameters {
  if (!argv[0].includes('electron.exe')) {
    argv = ['dummy'].concat(argv);
  }

  if (electronIsShitHack) {
    argv = electronIsShitArgumentSort(argv);
  }

  let version: string = '1.0.0';
  try {
    // won't happen in regular operation but lets us test this function outside vortex
    version = getApplication().version;
  } catch (err) {
    // nop
  }

  const commandLine = program
    .command('Vortex')
    .version(version)
    .option('-d, --download [url]', 'Start downloadling the specified url '
                                  + '(any supported protocol like nxm:, https:, ...).')
    .option('-i, --install [url]', 'Start downloadling & installing the specified url '
                                  + '(any supported protocol like nxm:, https:, ...).')
    .option('--install-extension [id]', 'Start downloadling & installing the specified '
                                       + 'vortex extension. id can be "modId:<number>".')
    .option('-g, --get [path]', 'Print the state variable at the specified path and quit. '
                              + 'For debugging')
    .option('-s, --set [path]=[value]', 'Change a value in the state. Please be very careful '
                                      + 'with this, incorrect use will break Vortex and you may '
                                      + 'lose data', assign)
    .option('--user-data [path]', 'Starts Vortex with a custom directory for the user data. '
                                  + 'Only use if you know what you\'re doing.')
    .option('--start-minimized', 'Starts Vortex in the task bar')
    .option('--game [game id]', 'Starts Vortex with a different game enabled')
    .option('--del [path]', 'Remove a value in state')
    .option('--run [path]', 'Execute the js program instead of Vortex itself.')
    .option('--report [path]', 'Send an error report. For internal use')
    .option('--restore [path]', 'Restore a state backup')
    .option('--merge [path]', 'Merge a state backup. Unlike restore, the content of the specified '
                              + 'state file will be merged into the existing state.')
    .option('--shared', 'Used in conjunction with set, get or del, this will access the database'
                                       + 'in the shared location instead of the per-user one')
    .option('--max-memory [size in MB]', 'Maximum amount of memory Vortex may use in MB '
                                       + '(defaults to 4096)')
    .option('--inspector', 'Start Vortex with the chrome inspector opened')
    .option('--profile [profile id]', 'Start Vortex with a specific profile active')
    // allow unknown options since they may be interpreted by electron/node
    .allowUnknownOption()
    .parse(argv || []).opts() as IParameters;

  return {
    ...startupSettings,
    ...commandLine,
  };
}

// arguments that should be dropped when restarting the application
const SKIP_ARGS = {
  '-d': 1,
  '--download': 1,
  '-i': 1,
  '--start-minimized': 1,
  '--game': 1,
  '--profile': 1,
  '--install': 1,
  '--install-extension': 1,
  '--restore': 1,
  '--merge': 1,
};

export function filterArgs(input: string[]): string[] {
  let skipCount = 0;
  const result = [];

  input.forEach((arg, idx) => {
    if (skipCount > 0) {
      skipCount --;
    } else if (idx === 0)  {
      // skip
    } else if (SKIP_ARGS[arg] !== undefined) {
      skipCount = SKIP_ARGS[arg];
    } else {
      result.push(arg);
    }
  });

  return result;
}

function relaunchImpl(args?: string[]) {
  app.relaunch({ args: [...filterArgs(process.argv), ...(args || []) ] });
  app.quit();
}

if (ipcMain !== undefined) {
  ipcMain.on('relaunch-self', (evt: Electron.IpcMainEvent, args: string[]) => {
    relaunchImpl(args);
  });
}

export function relaunch(args?: string[]) {
  if (ipcRenderer !== undefined) {
    ipcRenderer.send('relaunch-self', args);
  } else {
    relaunchImpl(args);
  }
}

export default parseCommandline;
