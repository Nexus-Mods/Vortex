import { app, ipcMain, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Interface for Shortcuts action configuration
 */
interface IShortcutAction {
  /** Unique action identifier */
  id: string;
  /** Action name displayed in Shortcuts */
  name: string;
  /** Action description */
  description: string;
  /** Input parameters */
  parameters: IShortcutParameter[];
  /** Output type */
  outputType: 'text' | 'json' | 'file' | 'boolean' | 'number';
  /** Action category */
  category: 'mods' | 'games' | 'profiles' | 'utilities';
  /** Whether the action requires Vortex to be running */
  requiresApp: boolean;
}

/**
 * Interface for Shortcuts action parameters
 */
interface IShortcutParameter {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: 'text' | 'number' | 'boolean' | 'file' | 'choice';
  /** Whether parameter is required */
  required: boolean;
  /** Default value */
  defaultValue?: any;
  /** Available choices (for choice type) */
  choices?: string[];
  /** Parameter description */
  description?: string;
}

/**
 * Interface for Shortcuts execution context
 */
interface IShortcutContext {
  /** Action being executed */
  action: IShortcutAction;
  /** Input parameters */
  parameters: Record<string, any>;
  /** Execution timestamp */
  timestamp: number;
  /** Shortcuts app version */
  shortcutsVersion?: string;
}

/**
 * Interface for Shortcuts execution result
 */
interface IShortcutResult {
  /** Whether execution was successful */
  success: boolean;
  /** Result data */
  data?: any;
  /** Error message if failed */
  error?: string;
  /** Execution time in milliseconds */
  executionTime: number;
}

/**
 * Manager for macOS Shortcuts app integration
 * Enables automation workflows and external control of Vortex
 */
export class MacOSShortcutsManager {
  private mInitialized: boolean = false;
  private mActions: Map<string, IShortcutAction> = new Map();
  private mHandlers: Map<string, (context: IShortcutContext) => Promise<IShortcutResult>> = new Map();
  private mShortcutsPath: string;

  constructor() {
    this.mShortcutsPath = path.join(app.getPath('userData'), 'shortcuts');
  }

  /**
   * Initialize the Shortcuts manager
   */
  public initialize(): void {
    if (this.mInitialized || process.platform !== 'darwin') {
      return;
    }

    try {
      this.ensureShortcutsDirectory();
      this.registerDefaultActions();
      this.setupShortcutsHandlers();
      this.exportShortcutsDefinitions();
      this.mInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Shortcuts manager:', error);
    }
  }

  /**
   * Register a new Shortcuts action
   */
  public registerAction(action: IShortcutAction, handler: (context: IShortcutContext) => Promise<IShortcutResult>): void {
    this.mActions.set(action.id, action);
    this.mHandlers.set(action.id, handler);
    
    // Re-export definitions when new actions are added
    if (this.mInitialized) {
      this.exportShortcutsDefinitions();
    }
  }

  /**
   * Unregister a Shortcuts action
   */
  public unregisterAction(actionId: string): void {
    this.mActions.delete(actionId);
    this.mHandlers.delete(actionId);
    
    // Re-export definitions when actions are removed
    if (this.mInitialized) {
      this.exportShortcutsDefinitions();
    }
  }

  /**
   * Execute a Shortcuts action
   */
  public async executeAction(actionId: string, parameters: Record<string, any>): Promise<IShortcutResult> {
    const startTime = Date.now();
    
    try {
      const action = this.mActions.get(actionId);
      const handler = this.mHandlers.get(actionId);
      
      if (!action || !handler) {
        return {
          success: false,
          error: `Action not found: ${actionId}`,
          executionTime: Date.now() - startTime
        };
      }

      // Validate parameters
      const validationError = this.validateParameters(action, parameters);
      if (validationError) {
        return {
          success: false,
          error: validationError,
          executionTime: Date.now() - startTime
        };
      }

      // Create execution context
      const context: IShortcutContext = {
        action,
        parameters,
        timestamp: startTime
      };

      // Execute the action
      const result = await handler(context);
      result.executionTime = Date.now() - startTime;
      
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get all registered actions
   */
  public getActions(): IShortcutAction[] {
    return Array.from(this.mActions.values());
  }

  /**
   * Get actions by category
   */
  public getActionsByCategory(category: string): IShortcutAction[] {
    return this.getActions().filter(action => action.category === category);
  }

  /**
   * Open Shortcuts app with Vortex actions
   */
  public async openShortcutsApp(): Promise<void> {
    try {
      await shell.openExternal('shortcuts://');
    } catch (error) {
      console.error('Failed to open Shortcuts app:', error);
    }
  }

  /**
   * Install example shortcuts
   */
  public async installExampleShortcuts(): Promise<void> {
    try {
      const examplesPath = path.join(this.mShortcutsPath, 'examples');
      
      if (!fs.existsSync(examplesPath)) {
        fs.mkdirSync(examplesPath, { recursive: true });
      }

      // Create example shortcut files
      await this.createExampleShortcuts(examplesPath);
      
      console.log('Example shortcuts installed');
    } catch (error) {
      console.error('Failed to install example shortcuts:', error);
    }
  }

  /**
   * Register default Shortcuts actions
   */
  private registerDefaultActions(): void {
    // Get installed games action
    this.registerAction({
      id: 'get-installed-games',
      name: 'Get Installed Games',
      description: 'Returns a list of games installed in Vortex',
      parameters: [],
      outputType: 'json',
      category: 'games',
      requiresApp: true
    }, async (context) => {
      // TODO: Integrate with actual game management system
      const games = [
        { id: 'skyrim', name: 'The Elder Scrolls V: Skyrim', installed: true },
        { id: 'fallout4', name: 'Fallout 4', installed: true }
      ];
      
      return {
        success: true,
        data: games,
        executionTime: 0
      };
    });

    // Install mod action
    this.registerAction({
      id: 'install-mod',
      name: 'Install Mod',
      description: 'Install a mod from Nexus Mods',
      parameters: [
        {
          name: 'modId',
          type: 'text',
          required: true,
          description: 'Nexus Mods ID of the mod to install'
        },
        {
          name: 'gameId',
          type: 'text',
          required: true,
          description: 'Game identifier'
        }
      ],
      outputType: 'boolean',
      category: 'mods',
      requiresApp: true
    }, async (context) => {
      const { modId, gameId } = context.parameters;
      
      // TODO: Integrate with actual mod installation system
      console.log(`Installing mod ${modId} for ${gameId}`);
      
      return {
        success: true,
        data: true,
        executionTime: 0
      };
    });

    // Get mod list action
    this.registerAction({
      id: 'get-mod-list',
      name: 'Get Mod List',
      description: 'Returns installed mods for a specific game',
      parameters: [
        {
          name: 'gameId',
          type: 'text',
          required: true,
          description: 'Game identifier'
        },
        {
          name: 'enabled',
          type: 'boolean',
          required: false,
          defaultValue: true,
          description: 'Only return enabled mods'
        }
      ],
      outputType: 'json',
      category: 'mods',
      requiresApp: true
    }, async (context) => {
      const { gameId, enabled } = context.parameters;
      
      // TODO: Integrate with actual mod management system
      const mods = [
        { id: 'mod1', name: 'Example Mod 1', enabled: true, version: '1.0.0' },
        { id: 'mod2', name: 'Example Mod 2', enabled: false, version: '2.1.0' }
      ];
      
      const filteredMods = enabled ? mods.filter(mod => mod.enabled) : mods;
      
      return {
        success: true,
        data: filteredMods,
        executionTime: 0
      };
    });

    // Create profile action
    this.registerAction({
      id: 'create-profile',
      name: 'Create Profile',
      description: 'Create a new mod profile',
      parameters: [
        {
          name: 'profileName',
          type: 'text',
          required: true,
          description: 'Name of the new profile'
        },
        {
          name: 'gameId',
          type: 'text',
          required: true,
          description: 'Game identifier'
        },
        {
          name: 'copyFrom',
          type: 'text',
          required: false,
          description: 'Profile to copy from (optional)'
        }
      ],
      outputType: 'boolean',
      category: 'profiles',
      requiresApp: true
    }, async (context) => {
      const { profileName, gameId, copyFrom } = context.parameters;
      
      // TODO: Integrate with actual profile management system
      console.log(`Creating profile ${profileName} for ${gameId}${copyFrom ? ` (copy from ${copyFrom})` : ''}`);
      
      return {
        success: true,
        data: true,
        executionTime: 0
      };
    });

    // Export mod list action
    this.registerAction({
      id: 'export-mod-list',
      name: 'Export Mod List',
      description: 'Export mod list to a file',
      parameters: [
        {
          name: 'gameId',
          type: 'text',
          required: true,
          description: 'Game identifier'
        },
        {
          name: 'format',
          type: 'choice',
          required: false,
          defaultValue: 'json',
          choices: ['json', 'csv', 'txt'],
          description: 'Export format'
        }
      ],
      outputType: 'file',
      category: 'utilities',
      requiresApp: true
    }, async (context) => {
      const { gameId, format } = context.parameters;
      
      // TODO: Integrate with actual export system
      const exportPath = path.join(app.getPath('downloads'), `vortex-mods-${gameId}.${format}`);
      
      return {
        success: true,
        data: exportPath,
        executionTime: 0
      };
    });
  }

  /**
   * Setup IPC handlers for Shortcuts communication
   */
  private setupShortcutsHandlers(): void {
    ipcMain.handle('shortcuts:execute', async (event, actionId: string, parameters: Record<string, any>) => {
      return await this.executeAction(actionId, parameters);
    });

    ipcMain.handle('shortcuts:actions', () => {
      return this.getActions();
    });

    ipcMain.handle('shortcuts:actions-by-category', (event, category: string) => {
      return this.getActionsByCategory(category);
    });

    ipcMain.handle('shortcuts:install-examples', async () => {
      await this.installExampleShortcuts();
    });

    // Handle URL scheme for Shortcuts app integration
    app.setAsDefaultProtocolClient('vortex-shortcuts');
    
    app.on('open-url', async (event, url) => {
      if (url.startsWith('vortex-shortcuts://')) {
        event.preventDefault();
        await this.handleShortcutsURL(url);
      }
    });
  }

  /**
   * Handle incoming Shortcuts URL
   */
  private async handleShortcutsURL(url: string): Promise<void> {
    try {
      const urlObj = new URL(url);
      const actionId = urlObj.pathname.substring(1); // Remove leading slash
      const parameters: Record<string, any> = {};
      
      // Parse query parameters
      urlObj.searchParams.forEach((value, key) => {
        parameters[key] = value;
      });
      
      const result = await this.executeAction(actionId, parameters);
      
      // Return result to Shortcuts app
      console.log('Shortcuts execution result:', result);
    } catch (error) {
      console.error('Failed to handle Shortcuts URL:', error);
    }
  }

  /**
   * Validate action parameters
   */
  private validateParameters(action: IShortcutAction, parameters: Record<string, any>): string | null {
    for (const param of action.parameters) {
      const value = parameters[param.name];
      
      if (param.required && (value === undefined || value === null)) {
        return `Required parameter missing: ${param.name}`;
      }
      
      if (value !== undefined && value !== null) {
        // Type validation
        switch (param.type) {
          case 'number':
            if (typeof value !== 'number' && isNaN(Number(value))) {
              return `Parameter ${param.name} must be a number`;
            }
            break;
          case 'boolean':
            if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
              return `Parameter ${param.name} must be a boolean`;
            }
            break;
          case 'choice':
            if (param.choices && !param.choices.includes(value)) {
              return `Parameter ${param.name} must be one of: ${param.choices.join(', ')}`;
            }
            break;
        }
      }
    }
    
    return null;
  }

  /**
   * Ensure shortcuts directory exists
   */
  private ensureShortcutsDirectory(): void {
    if (!fs.existsSync(this.mShortcutsPath)) {
      fs.mkdirSync(this.mShortcutsPath, { recursive: true });
    }
  }

  /**
   * Export Shortcuts definitions for external use
   */
  private exportShortcutsDefinitions(): void {
    try {
      const definitions = {
        version: '1.0.0',
        app: 'Vortex Mod Manager',
        actions: Array.from(this.mActions.values())
      };
      
      const definitionsPath = path.join(this.mShortcutsPath, 'vortex-actions.json');
      fs.writeFileSync(definitionsPath, JSON.stringify(definitions, null, 2));
      
      console.log(`Exported ${definitions.actions.length} Shortcuts actions to ${definitionsPath}`);
    } catch (error) {
      console.error('Failed to export Shortcuts definitions:', error);
    }
  }

  /**
   * Create example shortcut files
   */
  private async createExampleShortcuts(examplesPath: string): Promise<void> {
    // Example: Quick mod installation
    const quickInstallExample = {
      name: 'Quick Install Mod',
      description: 'Quickly install a mod by ID',
      actions: [
        {
          type: 'ask-for-input',
          prompt: 'Enter mod ID to install'
        },
        {
          type: 'ask-for-input',
          prompt: 'Enter game ID'
        },
        {
          type: 'open-url',
          url: 'vortex-shortcuts://install-mod?modId={input1}&gameId={input2}'
        }
      ]
    };
    
    fs.writeFileSync(
      path.join(examplesPath, 'quick-install-mod.json'),
      JSON.stringify(quickInstallExample, null, 2)
    );

    // Example: Export mod list
    const exportListExample = {
      name: 'Export Mod List',
      description: 'Export your mod list to Downloads folder',
      actions: [
        {
          type: 'ask-for-input',
          prompt: 'Enter game ID'
        },
        {
          type: 'choose-from-menu',
          prompt: 'Select export format',
          items: ['json', 'csv', 'txt']
        },
        {
          type: 'open-url',
          url: 'vortex-shortcuts://export-mod-list?gameId={input1}&format={menu}'
        }
      ]
    };
    
    fs.writeFileSync(
      path.join(examplesPath, 'export-mod-list.json'),
      JSON.stringify(exportListExample, null, 2)
    );
  }
}