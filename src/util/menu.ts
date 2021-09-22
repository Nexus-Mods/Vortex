import { IMainPageOptions } from '../types/IExtensionContext';

import ExtensionManager from './ExtensionManager';
import { debugTranslations, getMissingTranslations } from './i18n';
import { log } from './log';

import { remote, webFrame } from 'electron';
import * as path from 'path';
import { setZoomFactor } from '../actions/window';

const { app, Menu, clipboard, contentTracing } = remote;

/**
 * initializes the application menu and with it, hotkeys
 *
 * @export
 * @param {ExtensionManager} extensions
 */
export function initApplicationMenu(extensions: ExtensionManager) {

  const changeZoomFactor = (factor: number) => {
    if ((factor < 0.5) || (factor > 1.5)) {
      return;
    }
    factor = Math.round(factor * 10) / 10;
    extensions.getApi().sendNotification({
      id: 'zoom-factor-changed',
      type: 'info',
      message: extensions.getApi().translate('Zoom: {{factor}}%',
        { replace: { factor: Math.floor(factor * 100) } }),
      noDismiss: true,
      displayMS: 2000,
      localize: {
        message: false,
      },
    });
    webFrame.setZoomFactor(factor);
    extensions.getApi().store.dispatch(setZoomFactor(factor));
  };

  const fileMenu: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Close',
      click() {
        remote.app.quit();
      },
    },
  ];

  const refresh = () => {
    let recordTranslation = false;

    const viewMenu: Electron.MenuItemConstructorOptions[] = [];

    const alreadyAssigned = new Set<string>();

    // main pages
    extensions.apply('registerMainPage',
      (icon: string, title: string, element: any, options: IMainPageOptions) => {
        if ((options.visible === undefined) || options.visible()) {
          let accelerator = options.hotkeyRaw !== undefined ? options.hotkeyRaw :
            options.hotkey !== undefined ? 'CmdOrCtrl+Shift+' + options.hotkey : undefined;

          if (options.hotkey !== undefined) {
            if (alreadyAssigned.has(options.hotkey)) {
              log('warn', 'hotkey already used', { icon, title, options });
              accelerator = undefined;
            } else {
              alreadyAssigned.add(options.hotkey);
            }
          }

          viewMenu.push({
            label: title,
            visible: true,
            accelerator,
            click(item, focusedWindow) {
              if ((options.visible === undefined) || options.visible()) {
                extensions.getApi().events.emit('show-main-page', options.id || title);
              }
            },
          });
        }
      });

    viewMenu.push({
      label: 'Settings',
      accelerator: 'CmdOrCtrl+Shift+S',
      click(item, focusedWindow) {
        extensions.getApi().events.emit('show-main-page', 'application_settings');
      },
    });

    // development stuff
    if (process.env.NODE_ENV === 'development') {
      viewMenu.push({ type: 'separator' });
      viewMenu.push({
        label: 'Toggle Developer Tools',
        accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
        click(item, focusedWindow) {
          if (focusedWindow) {
            focusedWindow.webContents.toggleDevTools();
          } else {
            extensions.getApi().showErrorNotification('Failed to open developer tools', 'no focused window');
          }
        },
      });

      viewMenu.push({
        label: 'Reload',
        accelerator: 'F5',
        click(item, focusedWindow) {
          if (focusedWindow) {
            focusedWindow.webContents.reload();
          }
        },
      });
      viewMenu.push({
        label: 'Record missing translations',
        click(item, focusedWindow) {
          recordTranslation = !recordTranslation;
          debugTranslations(recordTranslation);
          const subMenu: Electron.Menu = (menu.items[1] as any).submenu as Electron.Menu;
          subMenu.items[copyTranslationsIdx].enabled = recordTranslation;
        },
      });

      const copyTranslationsIdx = viewMenu.length;
      viewMenu.push({
        label: 'Copy missing translations to clipboard',
        click(item, focusedWindow) {
          clipboard.writeText(JSON.stringify(getMissingTranslations(), undefined, 2));
        },
      });
      viewMenu[copyTranslationsIdx].enabled = false;
    }

    viewMenu.push(...[{
      label: 'Zoom In',
      accelerator: 'CmdOrCtrl+Shift+Plus',
      click(item, focusedWindow) {
        changeZoomFactor(webFrame.getZoomFactor() + 0.1);
      },
    }, {
      label: 'Zoom Out',
      accelerator: 'CmdOrCtrl+Shift+-',
      click(item, focusedWindow) {
        changeZoomFactor(webFrame.getZoomFactor() - 0.1);
      },
    }, {
      label: 'Reset Zoom',
      accelerator: 'CmdOrCtrl+0',
      click() {
        changeZoomFactor(1.0);
      },
    }]);

    let profiling: boolean = false;
    const stopProfiling = () => {
      const outPath = path.join(app.getPath('temp'), 'profile.dat');
      contentTracing.stopRecording(outPath)
        .then(() => {
          extensions.getApi().sendNotification({
            id: 'profiling',
            message: 'Profiling done',
            type: 'success',
          });
          profiling = false;
        })
        .catch(() => null);
    };

    const performanceMenu: Electron.MenuItemConstructorOptions[] = [{
      label: 'Start/Stop Profiling',
      accelerator: 'CmdOrCtrl+Shift+Alt+P',
      click() {
        if (!profiling) {
          const defaultTraceCategories: Readonly<string[]> = [
            '-*', 'devtools.timeline', 'disabled-by-default-devtools.timeline',
            'disabled-by-default-devtools.timeline.frame', 'toplevel', 'blink.console',
            'disabled-by-default-devtools.timeline.stack',
            'disabled-by-default-v8.cpu_profile', 'disabled-by-default-v8.cpu_profiler',
            'disabled-by-default-v8.cpu_profiler.hires',
          ];

          const options = {
            categoryFilter: defaultTraceCategories.join(','),
            traceOptions: 'record-until-full,enable-sampling',
            options: 'sampling-frequency=10000',
          }

          contentTracing.startRecording(options).then(() => {
            console.log('Tracing started');
            extensions.getApi().sendNotification({
              id: 'profiling',
              message: 'Profiling',
              type: 'activity',
              noDismiss: true,
              actions: [{
                title: 'Stop (Ctrl+Shift+Alt+P)',
                action: () => {
                  stopProfiling();
                },
              }],
            });
            profiling = true;
          });
        } else {
          stopProfiling();
        }
      },
    }];

    const menu = Menu.buildFromTemplate([
      { label: 'File', submenu: fileMenu },
      { label: 'View', submenu: viewMenu },
      { label: 'Performance', submenu: performanceMenu },
    ]);
    Menu.setApplicationMenu(menu);
  };
  refresh();
  return refresh;
}
