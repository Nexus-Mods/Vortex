/**
 * entry point for the main process
 */

import './util/application.electron';
import getVortexPath from './util/getVortexPath';
import { isWindows, isMacOS } from './util/platform';
import { setupMacOSPaths } from './util/macosPaths';

import { app, dialog, Menu, MenuItemConstructorOptions } from 'electron';
import * as path from 'path';

// Add TouchBar, systemPreferences, and autoUpdater imports for macOS
import { TouchBar, systemPreferences, autoUpdater } from 'electron';

// Add Spotlight integration import for macOS
let initializeSpotlight: () => Promise<void> = async () => {};
let indexVortexActions: () => Promise<void> = async () => {};

// Dynamically import Spotlight module without top-level await
import('./util/macosSpotlight')
  .then(spotlightModule => {
    initializeSpotlight = spotlightModule.initializeSpotlight;
    indexVortexActions = spotlightModule.indexVortexActions;
  })
  .catch(err => {
    console.warn('⚠️ Spotlight integration not available:', err);
    // Provide no-op functions if module is not available
    initializeSpotlight = async () => {};
    indexVortexActions = async () => {};
  });
const { TouchBarButton, TouchBarLabel, TouchBarSpacer } = TouchBar || {};

const earlyErrHandler = (error) => {
  if (error.stack.includes('[as dlopen]')) {
    dialog.showErrorBox(
      'Vortex failed to start up',
      `An unexpected error occurred while Vortex was initialising:

${error.message}

`

      + 'This is often caused by a bad installation of the app, '
      + 'a security app interfering with Vortex '
      + 'or a problem with the Microsoft Visual C++ Redistributable installed on your PC. '
      + 'To solve this issue please try the following:\n\n'

      + '- Wait a moment and try starting Vortex again\n'
      + '- Reinstall Vortex from the Nexus Mods website\n'
      + '- Install the latest Microsoft Visual C++ Redistributable (find it using a search engine)\n'
      + '- Disable anti-virus or other security apps that might interfere and install Vortex again\n\n'

      + 'If the issue persists, please create a thread in our support forum for further assistance.');
  } else {
    dialog.showErrorBox('Unhandled error',
                        'Vortex failed to start up. This is usually caused by foreign software (e.g. Anti Virus) '
      + 'interfering.\n\n' + error.stack);
  }
  app.exit(1);
};

process.on('uncaughtException', earlyErrHandler);
process.on('unhandledRejection', earlyErrHandler);

// ensure the cwd is always set to the path containing the exe, otherwise dynamically loaded
// dlls will not be able to load vc-runtime files shipped with Vortex.
// Setup macOS-specific paths before anything else
if (isMacOS()) {
  setupMacOSPaths();
}

process.chdir(getVortexPath('application'));

/* the below would completely restart Vortex to ensure everything is loaded with the cwd
   reset but that doesn't seem to be necessary
// if this is the primary instance, verify we run from the right cwd, otherwise
// vc runtime files might not load correctly
if (!process.argv.includes('--relaunched')
  && (path.normalize(process.cwd()).toLowerCase()
    !== path.normalize(getVortexPath('application')).toLowerCase())) {
  // tslint:disable-next-line:no-var-requires
  const cp: typeof child_processT = require('child_process');
  const args = [].concat(['--relaunched'], process.argv.slice(1));
  const proc = cp.spawn(process.execPath, args, {
    cwd: getVortexPath('application'),
    detached: true,
  });
  app.quit();
}
*/

import { DEBUG_PORT, HTTP_HEADER_SIZE } from './constants';

import * as sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

import requireRemap from './util/requireRemap';
requireRemap();

function setEnv(key: string, value: string, force?: boolean) {
  if ((process.env[key] === undefined) || force) {
    process.env[key] = value;
  }
}

if (process.env.NODE_ENV !== 'development') {
  setEnv('NODE_ENV', 'production', true);
} else {
  // tslint:disable-next-line:no-var-requires
  const rebuildRequire = require('./util/requireRebuild').default;
  rebuildRequire();
}

if (isWindows() && (process.env.NODE_ENV !== 'development')) {
  // On windows dlls may be loaded from directories in the path variable
  // (which I don't know why you'd ever want that) so I filter path quite aggressively here
  // to prevent dynamically loaded dlls to be loaded from unexpected locations.
  // The most common problem this should prevent is the edge dll being loaded from
  // "Browser Assistant" instead of our own.

  const userPath = (process.env.HOMEDRIVE || 'c:') + (process.env.HOMEPATH || '\\Users');
  const programFiles = process.env.ProgramFiles ||  'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const programData = process.env.ProgramData || 'C:\\ProgramData';

  const pathFilter = (envPath: string): boolean => {
    return !envPath.startsWith(userPath)
        && !envPath.startsWith(programData)
        && !envPath.startsWith(programFiles)
        && !envPath.startsWith(programFilesX86);
  };

  process.env['PATH_ORIG'] = process.env['PATH'].slice(0);
  process.env['PATH'] = process.env['PATH'].split(path.delimiter)
    .filter(pathFilter).join(path.delimiter);
} else if (isMacOS() && (process.env.NODE_ENV !== 'development')) {
  // On macOS, we may want to filter certain paths for security reasons
  // This is less critical than on Windows but still good practice
  const pathFilter = (envPath: string): boolean => {
    // Filter out potentially unsafe paths on macOS
    return !envPath.includes('/tmp/') 
        && !envPath.startsWith('/var/tmp/')
        && !envPath.includes('/.Trash/');
  };

  process.env['PATH_ORIG'] = process.env['PATH'].slice(0);
  process.env['PATH'] = process.env['PATH'].split(path.delimiter)
    .filter(pathFilter).join(path.delimiter);
}

// Produce english error messages (windows only atm), otherwise they don't get
// grouped correctly when reported through our feedback system
if (isWindows()) {
  try {
    // tslint:disable-next-line:no-var-requires
    const winapi = isWindows() ? (isWindows() ? require('winapi-bindings') : undefined) : undefined;
    winapi?.SetProcessPreferredUILanguages?.(['en-US']);
  } catch (err) {
    // nop
  }
}

import {} from './util/requireRebuild';

import Application from './app/Application';

import type { IPresetStep, IPresetStepCommandLine } from './types/IPreset';

import commandLine, { relaunch } from './util/commandLine';
import { sendReportFile, terminate, toError } from './util/errorHandling';
// ensures tsc includes this dependency
import {} from './util/extensionRequire';

// required for the side-effect!
import './util/exeIcon';
import './util/monkeyPatching';
import './util/webview';

import * as child_processT from 'child_process';
import * as fs from './util/fs';
import presetManager from './util/PresetManager';

process.env.Path = process.env.Path + path.delimiter + __dirname;

let application: Application;

const handleError = (error: any) => {
  if (Application.shouldIgnoreError(error)) {
    return;
  }

  terminate(toError(error), {});
};

async function firstTimeInit() {
  // use this to do first time setup, that is: code to be run
  // only the very first time vortex starts up.
  // This functionality was introduced but then we ended up solving
  // the problem in a different way that's why this is unused currently
}

async function main(): Promise<void> {
  // important: The following has to be synchronous!
  const mainArgs = commandLine(process.argv, false);
  if (mainArgs.report) {
    return sendReportFile(mainArgs.report)
      .then(() => {
        app.quit();
      });
  }

  const NODE_OPTIONS = process.env.NODE_OPTIONS || '';
  process.env.NODE_OPTIONS = NODE_OPTIONS
    + ` --max-http-header-size=${HTTP_HEADER_SIZE}`
    + ' --no-force-async-hooks-checks';

  if (mainArgs.disableGPU) {
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch('--disable-software-rasterizer');
    app.commandLine.appendSwitch('--disable-gpu');
  }

  app.commandLine.appendSwitch('disable-features', 'WidgetLayering');
  app.commandLine.appendSwitch('disable-features', 'UseEcoQoSForBackgroundProcess');

  if (isMacOS()) {
    const template: MenuItemConstructorOptions[] = [
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { 
            label: 'Preferences...',
            accelerator: 'CmdOrCtrl+,',
            click: () => {
              // TODO: Implement preferences dialog
            }
          },
          { type: 'separator' },
          { 
            label: 'Check for Updates...',
            accelerator: 'Cmd+Shift+U',
            click: () => {
              // TODO: Implement update check
            }
          },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      {
        label: 'File',
        submenu: [
          {
            label: 'New',
            submenu: [
              {
                label: 'Profile',
                accelerator: 'CmdOrCtrl+N',
                click: () => {
                  // TODO: Implement new profile
                }
              }
            ]
          },
          { type: 'separator' },
          { 
            label: 'Import',
            accelerator: 'CmdOrCtrl+I',
            click: () => {
              // TODO: Implement import functionality
            }
          },
          { 
            label: 'Export',
            accelerator: 'CmdOrCtrl+E',
            click: () => {
              // TODO: Implement export functionality
            }
          },
          { type: 'separator' },
          { 
            label: 'Check for Updates...',
            accelerator: 'Cmd+Shift+U',
            click: () => {
              // Check for updates
              if (application && typeof application.checkForUpdates === 'function') {
                application.checkForUpdates();
              }
            }
          },
          { type: 'separator' },
          { role: 'close' }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            label: 'Find',
            submenu: [
              { label: 'Find', accelerator: 'CmdOrCtrl+F' },
              { label: 'Find Next', accelerator: 'CmdOrCtrl+G' },
              { label: 'Find Previous', accelerator: 'CmdOrCtrl+Shift+G' },
              { type: 'separator' },
              { label: 'Replace', accelerator: 'CmdOrCtrl+Alt+F' }
            ]
          },
          { type: 'separator' },
          {
            label: 'Speech',
            submenu: [
              { role: 'startSpeaking' },
              { role: 'stopSpeaking' }
            ]
          }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { 
            label: 'Toggle Sidebar',
            accelerator: 'CmdOrCtrl+Shift+D',
            click: () => {
              // TODO: Implement sidebar toggle
            }
          },
          { 
            label: 'Enter Full Screen',
            accelerator: 'Ctrl+Cmd+F',
            click: () => {
              // TODO: Implement full screen toggle
            }
          }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          { type: 'separator' },
          { 
            label: 'Show Dashboard',
            accelerator: 'CmdOrCtrl+Shift+H',
            click: () => {
              // TODO: Implement dashboard view
            }
          },
          { 
            label: 'Show Mods',
            accelerator: 'CmdOrCtrl+Shift+M',
            click: () => {
              // TODO: Implement mods view
            }
          },
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ]
      },
      {
        role: 'help',
        submenu: [
          {
            label: 'Vortex Documentation',
            accelerator: 'F1',
            click: async () => {
              // TODO: Implement documentation link
            }
          },
          {
            label: 'Vortex on Nexus Mods',
            click: async () => {
              // TODO: Implement Nexus Mods link
            }
          },
          { type: 'separator' },
          {
            label: 'Report an Issue',
            accelerator: 'CmdOrCtrl+Shift+R',
            click: async () => {
              // TODO: Implement issue reporting
            }
          }
        ]
      }
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    // Create custom dock menu for macOS
    const dockMenu = Menu.buildFromTemplate([
      {
        label: 'New Profile',
        click: () => {
          // TODO: Implement new profile creation
        }
      },
      {
        label: 'Open Settings',
        click: () => {
          // TODO: Implement settings dialog
        }
      },
      { type: 'separator' },
      {
        label: 'Check for Updates',
        click: () => {
          // Check for updates
          if (application && typeof application.checkForUpdates === 'function') {
            application.checkForUpdates();
          }
        }
      }
    ]);
    app.dock.setMenu(dockMenu);
    
    // Set up Touch Bar support for MacBook Pro users
    if (TouchBar) {
      try {
        // Create Touch Bar items
        const refreshButton = new TouchBarButton({
          label: '🔄 Refresh',
          backgroundColor: '#3c3c3c',
          click: () => {
            // Send refresh event to the main window
            if (application && typeof application.refresh === 'function') {
              application.refresh();
            }
          }
        });

        const settingsButton = new TouchBarButton({
          label: '⚙️ Settings',
          backgroundColor: '#3c3c3c',
          click: () => {
            // Send settings event to the main window
            if (application && typeof application.openSettings === 'function') {
              application.openSettings();
            }
          }
        });

        const profileLabel = new TouchBarLabel({
          label: 'Vortex',
          textColor: '#ffffff'
        });

        // Create the Touch Bar
        const touchBar = new TouchBar({
          items: [
            profileLabel,
            new TouchBarSpacer({ size: 'small' }),
            refreshButton,
            new TouchBarSpacer({ size: 'small' }),
            settingsButton
          ]
        });

        // Set the Touch Bar (will be applied to the main window when it's created)
        // We'll set it on the app level so it can be applied to any window
        app.whenReady().then(() => {
          // The touch bar will be set on the window when it's created
          // Store reference for later use
          (global as any).vortexTouchBar = touchBar;
        });
      } catch (err) {
        console.warn('⚠️ Failed to initialize Touch Bar support:', err);
      }
    }
    
    // Add macOS-specific accessibility enhancements
    try {
      // Enable accessibility support for screen readers and other assistive technologies
      // This will automatically enable when VoiceOver or other assistive tech is detected
      // but we can also manually enable it if needed
      
      // Listen for accessibility support changes
      if (systemPreferences) {
        systemPreferences.subscribeNotification(
          'AXManualAccessibility',
          (event, userInfo) => {
            console.log('♿ Accessibility support changed:', userInfo);
            // Could be used to update UI or behavior based on accessibility status
          }
        );
        
        // Note: isAccessibilitySupportEnabled is not available in current Electron version
        // Accessibility features will be handled through other means
      }
    } catch (err) {
      console.warn('⚠️ Failed to initialize accessibility enhancements:', err);
    }
    
    // Set up auto-update for macOS
    setupAutoUpdate();
    
    // Initialize Spotlight integration
    // Note: These functions might still be no-ops if the module hasn't loaded yet
    // This is fine as they're non-critical features
    initializeSpotlight().catch(err => {
      console.warn('⚠️ Failed to initialize Spotlight integration:', err);
    });
    indexVortexActions().catch(err => {
      console.warn('⚠️ Failed to index Vortex actions for Spotlight:', err);
    });
  }

  // --run has to be evaluated *before* we request the single instance lock!
  if (mainArgs.run !== undefined) {
    // Vortex here acts only as a trampoline (probably elevated) to start
    // some other process
    const cp: typeof child_processT = require('child_process');
    cp.spawn(process.execPath, [ mainArgs.run ], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
      },
      stdio: 'inherit',
      detached: true,
    })
      .on('error', err => {
      // TODO: In practice we have practically no information about what we're running
      //       at this point
        dialog.showErrorBox('Failed to run script', err.message);
      });
    // quit this process, the new one is detached
    app.quit();
    return;
  }

  if (!app.requestSingleInstanceLock()) {
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch('--in-process-gpu');
    app.commandLine.appendSwitch('--disable-software-rasterizer');
    app.quit();
    return;
  }

  // async code only allowed from here on out

  if (!presetManager.now('commandline', (step: IPresetStep): Promise<void> => {
    (step as IPresetStepCommandLine).arguments.forEach(arg => {
      mainArgs[arg.key] = arg.value ?? true;
    });
    return Promise.resolve();
  })) {
    // if the first step was not a command-line instruction but we encounter one
    // further down the preset queue, Vortex has to restart to process it.
    // this is only relevant for the main process, if the renderer process encounters
    // this it will have its own handler and can warn the user the restart is coming
    presetManager.on('commandline', (): Promise<void> => {
      // return a promise that doesn't finish
      relaunch();
      return new Promise(() => {
        // nop
      });
    });
  }

  try {
    await fs.statAsync(getVortexPath('userData'));
  } catch (err) {
    await firstTimeInit();
  }

  process.on('uncaughtException', handleError);
  process.on('unhandledRejection', handleError);

  if ((process.env.NODE_ENV === 'development')
      && (!app.commandLine.hasSwitch('remote-debugging-port'))) {
    app.commandLine.appendSwitch('remote-debugging-port', DEBUG_PORT);
  }

  // tslint:disable-next-line:no-submodule-imports
  require('@electron/remote/main').initialize();

  let fixedT = require('i18next').getFixedT('en');
  try {
    fixedT('dummy');
  } catch (err) {
    fixedT = input => input;
  }

  /* allow application controlled scaling
  if (isWindows()) {
    app.commandLine.appendSwitch('high-dpi-support', 'true');
    app.commandLine.appendSwitch('force-device-scale-factor', '1');
  }
  */
  application = new Application(mainArgs);
}

main();

// Add auto-update functions
function setupAutoUpdate() {
  if (!isMacOS()) {
    return;
  }
  
  try {
    // Set the update feed URL - configurable via environment variable or default to Nexus Mods
    const updateFeedUrl = process.env.VORTEX_UPDATE_URL || 
                         'https://api.nexusmods.com/v1/vortex/updates/mac';
    
    // Only set up auto-updater if we have a valid update URL
    if (!updateFeedUrl || updateFeedUrl.includes('your-update-server.com')) {
      console.warn('Auto-updater disabled: No valid update URL configured');
      return;
    }
    
    // Set the feed URL for auto updates
    autoUpdater.setFeedURL({
      url: updateFeedUrl,
      serverType: 'json' // Use JSON format for updates (Squirrel.Mac format)
    });
    
    // Set up event listeners for auto updater
    autoUpdater.on('error', (error) => {
      console.error('❌ Auto update error:', error);
      // Could show error notification to user
    });
    
    autoUpdater.on('checking-for-update', () => {
      console.log('🔍 Checking for updates...');
      // Could show checking notification to user
    });
    
    autoUpdater.on('update-available', () => {
      console.log('📦 Update available');
      // Could show update available notification to user
    });
    
    autoUpdater.on('update-not-available', () => {
      console.log('✅ No updates available');
      // Could show up to date notification to user
    });
    
    autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
      console.log('⬇️ Update downloaded:', releaseName);
      // Show dialog to user asking if they want to restart and install
      if (application) {
        try {
          const mainWindow = application.getMainWindow?.();
          if (mainWindow) {
            dialog.showMessageBox(mainWindow.getHandle(), {
              type: 'info',
              title: 'Update Available',
              message: 'A new version of Vortex is available!',
              detail: `Version ${releaseName} has been downloaded. Would you like to restart and install it now?`,
              buttons: ['Later', 'Restart and Install'],
              defaultId: 1,
              cancelId: 0
            }).then((result) => {
              if (result.response === 1) {
                // User wants to install now
                autoUpdater.quitAndInstall();
              }
            });
          }
        } catch (err) {
          console.warn('⚠️ Failed to show update dialog:', err);
        }
      }
    });
    
    // Check for updates periodically (every hour)
    setInterval(() => {
      checkForUpdates();
    }, 60 * 60 * 1000); // 1 hour
    
    // Check for updates on app start
    app.whenReady().then(() => {
      // Delay the initial check to allow the app to fully start
      setTimeout(() => {
        checkForUpdates();
      }, 30000); // 30 seconds after app start
    });
    
  } catch (err) {
    console.warn('⚠️ Failed to set up auto update:', err);
  }
}

function checkForUpdates() {
  if (!isMacOS()) {
    return;
  }
  
  // Check if we're in development mode
  const isDevelopment = process.env.NODE_ENV === 'development' || 
                       process.env.VORTEX_DEV === 'true' ||
                       !app.isPackaged ||
                       process.defaultApp ||
                       /[\\/]electron-prebuilt[\\/]/.test(process.execPath) ||
                       /[\\/]electron[\\/]/.test(process.execPath);
  
  if (isDevelopment) {
    console.log('Auto-updater disabled in development mode');
    return;
  }
  
  try {
    console.log('🔍 Checking for updates...');
    autoUpdater.checkForUpdates();
  } catch (err) {
    console.warn('⚠️ Failed to check for updates:', err);
  }
}
