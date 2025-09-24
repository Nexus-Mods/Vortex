import { app, Menu, MenuItem, shell, dialog, BrowserWindow } from 'electron';
import { IExtensionApi } from '../types/IExtensionContext';
import { log } from './log';
import { isMacOS } from './platform';
import * as path from 'path';

// Using Electron's built-in MenuItemConstructorOptions instead of custom interface

export class MacOSMenuManager {
  private api: IExtensionApi;
  private isInitialized: boolean = false;
  private currentMenu: Menu | null = null;

  constructor(api: IExtensionApi) {
    this.api = api;
  }

  /**
   * Initialize the macOS menu manager
   */
  public initialize(): void {
    log('debug', 'MacOSMenuManager: Starting initialization...');
    log('debug', 'MacOSMenuManager: Platform check', { platform: process.platform });
    log('debug', 'MacOSMenuManager: isMacOS() result', { isMacOS: isMacOS() });
    
    if (!isMacOS()) {
      log('debug', 'MacOSMenuManager: Not on macOS, skipping initialization');
      return;
    }

    if (this.isInitialized) {
      log('warn', 'MacOSMenuManager already initialized');
      return;
    }

    try {
      log('debug', 'MacOSMenuManager: About to call setupMacOSMenu()');
      this.setupMacOSMenu();
      this.isInitialized = true;
      log('info', 'MacOSMenuManager initialized successfully');
    } catch (error) {
      log('error', 'Failed to initialize MacOSMenuManager', error);
      log('error', 'Error details:', error.stack);
    }
  }

  /**
   * Set up the complete macOS menu bar following HIG
   */
  private setupMacOSMenu(): void {
    log('debug', 'MacOSMenuManager: Setting up macOS menu...');
    log('debug', 'MacOSMenuManager: Checking Electron imports', { menuType: typeof Menu, appType: typeof app });
    
    const template: Electron.MenuItemConstructorOptions[] = [
      // Application Menu (Vortex)
      {
        label: app.getName(),
        submenu: [
          {
            label: `About ${app.getName()}`,
            click: () => this.showAboutDialog()
          },
          { type: 'separator' },
          {
            label: 'Preferences...',
            accelerator: 'Cmd+,',
            click: () => this.api.events.emit('show-settings')
          },
          { type: 'separator' },
          {
            label: 'Services',
            role: 'services',
            submenu: []
          },
          { type: 'separator' },
          {
            label: `Hide ${app.getName()}`,
            accelerator: 'Cmd+H',
            role: 'hide'
          },
          {
            label: 'Hide Others',
            accelerator: 'Cmd+Alt+H',
            role: 'hideOthers'
          },
          {
            label: 'Show All',
            role: 'unhide'
          },
          { type: 'separator' },
          {
            label: `Quit ${app.getName()}`,
            accelerator: 'Cmd+Q',
            click: () => app.quit()
          }
        ]
      },

      // File Menu
      {
        label: 'File',
        submenu: [
          {
            label: 'New Profile...',
            accelerator: 'Cmd+N',
            click: () => this.api.events.emit('create-profile')
          },
          {
            label: 'Open...',
            accelerator: 'Cmd+O',
            click: () => this.showOpenDialog()
          },
          { type: 'separator' },
          {
            label: 'Import Mod Archive...',
            accelerator: 'Cmd+I',
            click: () => this.api.events.emit('import-mod-archive')
          },
          {
            label: 'Export Profile...',
            accelerator: 'Cmd+E',
            click: () => this.api.events.emit('export-profile')
          },
          { type: 'separator' },
          {
            label: 'Recent Profiles',
            submenu: this.buildRecentProfilesMenu()
          },
          { type: 'separator' },
          {
            label: 'Close Window',
            accelerator: 'Cmd+W',
            click: () => {
              const focusedWindow = BrowserWindow.getFocusedWindow();
              if (focusedWindow) {
                focusedWindow.close();
              }
            }
          }
        ]
      },

      // Edit Menu
      {
        label: 'Edit',
        submenu: [
          {
            label: 'Undo',
            accelerator: 'Cmd+Z',
            role: 'undo'
          },
          {
            label: 'Redo',
            accelerator: 'Shift+Cmd+Z',
            role: 'redo'
          },
          { type: 'separator' },
          {
            label: 'Cut',
            accelerator: 'Cmd+X',
            role: 'cut'
          },
          {
            label: 'Copy',
            accelerator: 'Cmd+C',
            role: 'copy'
          },
          {
            label: 'Paste',
            accelerator: 'Cmd+V',
            role: 'paste'
          },
          {
            label: 'Select All',
            accelerator: 'Cmd+A',
            role: 'selectAll'
          },
          { type: 'separator' },
          {
            label: 'Find...',
            accelerator: 'Cmd+F',
            click: () => this.api.events.emit('show-search')
          }
        ]
      },

      // View Menu
      {
        label: 'View',
        submenu: [
          {
            label: 'Reload',
            accelerator: 'Cmd+R',
            click: () => this.api.events.emit('refresh-main-window')
          },
          {
            label: 'Force Reload',
            accelerator: 'Cmd+Shift+R',
            click: () => {
              const focusedWindow = BrowserWindow.getFocusedWindow();
              if (focusedWindow) {
                focusedWindow.webContents.reloadIgnoringCache();
              }
            }
          },
          {
            label: 'Toggle Developer Tools',
            accelerator: 'Alt+Cmd+I',
            click: () => {
              const focusedWindow = BrowserWindow.getFocusedWindow();
              if (focusedWindow) {
                focusedWindow.webContents.toggleDevTools();
              }
            }
          },
          { type: 'separator' },
          {
            label: 'Actual Size',
            accelerator: 'Cmd+0',
            role: 'resetZoom'
          },
          {
            label: 'Zoom In',
            accelerator: 'Cmd+Plus',
            role: 'zoomIn'
          },
          {
            label: 'Zoom Out',
            accelerator: 'Cmd+-',
            role: 'zoomOut'
          },
          { type: 'separator' },
          {
            label: 'Toggle Fullscreen',
            accelerator: 'Ctrl+Cmd+F',
            role: 'togglefullscreen'
          },
          { type: 'separator' },
          {
            label: 'Show Sidebar',
            accelerator: 'Cmd+Shift+S',
            type: 'checkbox',
            checked: true,
            click: () => this.api.events.emit('toggle-sidebar')
          }
        ]
      },

      // Mods Menu
      {
        label: 'Mods',
        submenu: [
          {
            label: 'Install Mod...',
            accelerator: 'Cmd+Shift+I',
            click: () => this.api.events.emit('install-mod')
          },
          {
            label: 'Enable All Mods',
            click: () => this.api.events.emit('enable-all-mods')
          },
          {
            label: 'Disable All Mods',
            click: () => this.api.events.emit('disable-all-mods')
          },
          { type: 'separator' },
          {
            label: 'Check for Updates',
            accelerator: 'Cmd+U',
            click: () => this.api.events.emit('check-mod-updates')
          },
          {
            label: 'Refresh Mod List',
            accelerator: 'F5',
            click: () => this.api.events.emit('refresh-mods')
          },
          { type: 'separator' },
          {
            label: 'Open Mods Folder',
            click: () => this.api.events.emit('open-mods-folder')
          },
          {
            label: 'Open Downloads Folder',
            accelerator: 'Cmd+Shift+D',
            click: () => this.api.events.emit('open-downloads-folder')
          }
        ]
      },

      // Tools Menu
      {
        label: 'Tools',
        submenu: [
          {
            label: 'Deploy Mods',
            accelerator: 'Cmd+D',
            click: () => this.api.events.emit('deploy-mods')
          },
          {
            label: 'Purge Mods',
            accelerator: 'Cmd+Shift+P',
            click: () => this.api.events.emit('purge-mods')
          },
          { type: 'separator' },
          {
            label: 'Run LOOT',
            click: () => this.api.events.emit('run-loot')
          },
          {
            label: 'Run Game',
            accelerator: 'Cmd+G',
            click: () => this.api.events.emit('quick-launch')
          },
          { type: 'separator' },
          {
            label: 'Backup Profile...',
            click: () => this.api.events.emit('backup-profile')
          },
          {
            label: 'Restore Profile...',
            click: () => this.api.events.emit('restore-profile')
          }
        ]
      },

      // Window Menu
      {
        label: 'Window',
        submenu: [
          {
            label: 'Minimize',
            accelerator: 'Cmd+M',
            role: 'minimize'
          },
          {
            label: 'Close',
            accelerator: 'Cmd+W',
            role: 'close'
          },
          { type: 'separator' },
          {
            label: 'Bring All to Front',
            role: 'front'
          }
        ]
      },

      // Help Menu
      {
        label: 'Help',
        submenu: [
          {
            label: 'Vortex Help',
            accelerator: 'Cmd+?',
            click: () => shell.openExternal('https://wiki.nexusmods.com/index.php/Category:Vortex')
          },
          {
            label: 'Keyboard Shortcuts',
            click: () => this.showKeyboardShortcuts()
          },
          { type: 'separator' },
          {
            label: 'Report Issue...',
            click: () => shell.openExternal('https://github.com/Nexus-Mods/Vortex/issues')
          },
          {
            label: 'Check for Updates...',
            click: () => this.api.events.emit('check-for-updates')
          },
          { type: 'separator' },
          {
            label: 'Open Log Folder',
            click: () => this.api.events.emit('open-log-folder')
          },
          {
            label: 'Reset to Defaults',
            click: () => this.showResetDialog()
          }
        ]
      }
    ];

    log('debug', 'MacOSMenuManager: Building menu from template...');
    this.currentMenu = this.buildMenuFromTemplate(template);
    log('debug', 'MacOSMenuManager: Menu built successfully, setting application menu...');
    Menu.setApplicationMenu(this.currentMenu);
    log('debug', 'MacOSMenuManager: Application menu set successfully');
  }

  /**
   * Build recent profiles submenu
   */
  private buildRecentProfilesMenu(): Electron.MenuItemConstructorOptions[] {
    // This would typically get recent profiles from the store
    // For now, return a placeholder
    return [
      {
        label: 'No Recent Profiles',
        enabled: false
      }
    ];
  }

  /**
   * Show about dialog
   */
  private showAboutDialog(): void {
    dialog.showMessageBox({
      type: 'info',
      title: `About ${app.getName()}`,
      message: app.getName(),
      detail: `Version ${app.getVersion()}

A modern mod manager for your games.

© Nexus Mods`,
      buttons: ['OK']
    });
  }

  /**
   * Show open dialog
   */
  private showOpenDialog(): void {
    dialog.showOpenDialog({
      title: 'Open Mod Archive',
      filters: [
        { name: 'Mod Archives', extensions: ['zip', '7z', 'rar'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile', 'multiSelections']
    }).then(result => {
      if (!result.canceled && result.filePaths.length > 0) {
        result.filePaths.forEach(filePath => {
          this.api.events.emit('import-mod-file', filePath);
        });
      }
    });
  }

  /**
   * Show keyboard shortcuts dialog
   */
  private showKeyboardShortcuts(): void {
    const shortcuts = [
      'Cmd+N - New Profile',
      'Cmd+O - Open Mod Archive',
      'Cmd+I - Import Mod Archive',
      'Cmd+E - Export Profile',
      'Cmd+W - Close Window',
      'Cmd+R - Reload',
      'Cmd+F - Find',
      'Cmd+G - Run Game',
      'Cmd+D - Deploy Mods',
      'Cmd+U - Check for Updates',
      'Cmd+, - Preferences',
      'Cmd+Q - Quit Vortex'
    ];

    dialog.showMessageBox({
      type: 'info',
      title: 'Keyboard Shortcuts',
      message: 'Vortex Keyboard Shortcuts',
      detail: shortcuts.join('\n'),
      buttons: ['OK']
    });
  }

  /**
   * Show reset dialog
   */
  private showResetDialog(): void {
    dialog.showMessageBox({
      type: 'warning',
      title: 'Reset to Defaults',
      message: 'Are you sure you want to reset Vortex to default settings?',
      detail: 'This will reset all settings but keep your mods and profiles.',
      buttons: ['Cancel', 'Reset'],
      defaultId: 0,
      cancelId: 0
    }).then(result => {
      if (result.response === 1) {
        this.api.events.emit('reset-to-defaults');
      }
    });
  }

  /**
   * Build Electron menu from template
   */
  private buildMenuFromTemplate(template: Electron.MenuItemConstructorOptions[]): Electron.Menu {
    log('debug', 'MacOSMenuManager: Building menu from template', { itemCount: template.length });
    const menuItems = template.map(item => this.buildMenuItem(item));
    log('debug', 'MacOSMenuManager: Menu items built, creating Electron menu...');
    const menu = Menu.buildFromTemplate(menuItems);
    log('debug', 'MacOSMenuManager: Electron menu created successfully');
    return menu;
  }

  /**
   * Build individual menu item
   */
  private buildMenuItem(item: Electron.MenuItemConstructorOptions): Electron.MenuItemConstructorOptions {
    const menuItem: Electron.MenuItemConstructorOptions = {
      type: item.type || 'normal',
      enabled: item.enabled !== false,
      visible: item.visible !== false
    };

    if (item.label) {
      menuItem.label = item.label;
    }

    if (item.accelerator) {
      menuItem.accelerator = item.accelerator;
    }

    if (item.role) {
      menuItem.role = item.role as any;
    }

    if (item.click) {
      menuItem.click = item.click;
    }

    if (item.type === 'checkbox' || item.type === 'radio') {
      menuItem.checked = item.checked || false;
    }

    if (item.submenu && Array.isArray(item.submenu)) {
      menuItem.submenu = item.submenu.map(subItem => this.buildMenuItem(subItem));
    }

    return menuItem;
  }

  /**
   * Update menu item state
   */
  public updateMenuItem(menuPath: string[], updates: Partial<Electron.MenuItemConstructorOptions>): void {
    if (!this.currentMenu || !isMacOS()) return;

    try {
      // This would require traversing the menu structure to find and update specific items
      // For now, we'll rebuild the entire menu when updates are needed
      this.setupMacOSMenu();
      log('debug', 'Menu updated', { menuPath, updates });
    } catch (error) {
      log('error', 'Failed to update menu item', error);
    }
  }

  /**
   * Get current menu
   */
  public getCurrentMenu(): Menu | null {
    return this.currentMenu;
  }
}

export default MacOSMenuManager;