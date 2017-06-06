import { IMainPageOptions } from '../types/IExtensionContext';

import ExtensionManager from './ExtensionManager';
import { debugTranslations, getMissingTranslations } from './i18n';
import { log } from './log';

import { remote } from 'electron';

const { Menu, clipboard } = remote;

/**
 * initializes the application menu and with it, hotkeys
 *
 * @export
 * @param {ExtensionManager} extensions
 */
export function initApplicationMenu(extensions: ExtensionManager) {
  const fileMenu: Electron.MenuItemOptions[] = [
    {
      role: 'close',
    },
  ];

  let recordTranslation = false;

  const viewMenu: Electron.MenuItemOptions[] = [];

  // main pages
  extensions.apply('registerMainPage',
    (icon: string, title: string, element: any, options: IMainPageOptions) => {
      viewMenu.push({
        label: title,
        accelerator: options.hotkey !== undefined ? 'CmdOrCtrl+' + options.hotkey : undefined,
        click (item, focusedWindow) {
          extensions.getApi().events.emit('show-main-page', title);
        },
      });
  });

  // other dialogs
  viewMenu.push({ type: 'separator' });
  viewMenu.push({
    label: 'Settings',
    accelerator: 'CmdOrCtrl+Shift+S',
    click (item, focusedWindow) {
      extensions.getApi().events.emit('show-modal', 'settings');
    },
  });

  viewMenu.push({ type: 'separator' });
  viewMenu.push({
    label: 'Toggle Developer Tools',
    accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
    click(item, focusedWindow) {
      if (focusedWindow) {
        focusedWindow.webContents.toggleDevTools();
      }
    },
  });

  // development stuff
  if (process.env.NODE_ENV === 'development') {
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
        log('info', 'toogle', { recordTranslation, label: viewMenu[viewMenu.length - 1].label });
        const subMenu: Electron.Menu = menu.items[1].submenu as Electron.Menu;
        subMenu.items[viewMenu.length - 1].enabled = recordTranslation;
      },
    });
    viewMenu.push({
      label: 'Copy missing translations to clipboard',
      click(item, focusedWindow) {
        clipboard.writeText(JSON.stringify(getMissingTranslations(), undefined, 2));
      },
    });
    viewMenu[viewMenu.length - 1].enabled = false;
  }

  const menu = Menu.buildFromTemplate([
    { label: 'File', submenu: fileMenu },
    { label: 'View', submenu: viewMenu },
  ]);
  Menu.setApplicationMenu(menu);
}
