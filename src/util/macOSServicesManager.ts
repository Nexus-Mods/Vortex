import { app, Menu, MenuItem, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Interface for service action configuration
 */
interface IServiceAction {
  /** Unique identifier for the service */
  id: string;
  /** Display name in Services menu */
  title: string;
  /** Description of what the service does */
  description: string;
  /** Supported file types (extensions) */
  supportedTypes: string[];
  /** Whether the service accepts text input */
  acceptsText: boolean;
  /** Whether the service accepts files */
  acceptsFiles: boolean;
  /** Handler function for the service */
  handler: (input: string | string[]) => Promise<void>;
}

/**
 * Interface for Finder integration options
 */
interface IFinderIntegration {
  /** Whether to add context menu items */
  enableContextMenu: boolean;
  /** Whether to add toolbar buttons */
  enableToolbarButtons: boolean;
  /** Custom icon path */
  iconPath?: string;
}

/**
 * Manager for macOS Services integration
 * Provides system-wide context menu actions and Finder integration
 */
export class MacOSServicesManager {
  private mInitialized: boolean = false;
  private mServices: Map<string, IServiceAction> = new Map();
  private mFinderIntegration: IFinderIntegration;

  constructor() {
    this.mFinderIntegration = {
      enableContextMenu: true,
      enableToolbarButtons: false
    };
  }

  /**
   * Initialize the Services manager
   */
  public initialize(): void {
    if (this.mInitialized || process.platform !== 'darwin') {
      return;
    }

    try {
      this.registerDefaultServices();
      this.setupServiceHandlers();
      this.setupFinderIntegration();
      this.mInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Services manager:', error);
    }
  }

  /**
   * Register a custom service action
   */
  public registerService(service: IServiceAction): void {
    this.mServices.set(service.id, service);
    
    if (this.mInitialized) {
      this.updateServicesMenu();
    }
  }

  /**
   * Unregister a service action
   */
  public unregisterService(serviceId: string): void {
    this.mServices.delete(serviceId);
    
    if (this.mInitialized) {
      this.updateServicesMenu();
    }
  }

  /**
   * Get all registered services
   */
  public getServices(): IServiceAction[] {
    return Array.from(this.mServices.values());
  }

  /**
   * Configure Finder integration options
   */
  public configureFinderIntegration(options: Partial<IFinderIntegration>): void {
    this.mFinderIntegration = { ...this.mFinderIntegration, ...options };
    
    if (this.mInitialized) {
      this.updateFinderIntegration();
    }
  }

  /**
   * Handle service invocation from system
   */
  public async handleServiceInvocation(serviceId: string, input: string | string[]): Promise<void> {
    const service = this.mServices.get(serviceId);
    if (!service) {
      console.error(`Unknown service: ${serviceId}`);
      return;
    }

    try {
      await service.handler(input);
    } catch (error) {
      console.error(`Service ${serviceId} failed:`, error);
    }
  }

  /**
   * Create Services menu for application
   */
  public createServicesMenu(): MenuItem[] {
    const services = Array.from(this.mServices.values());
    
    return services.map(service => new MenuItem({
      label: service.title,
      click: () => {
        // This would typically be triggered by the system
        console.log(`Service ${service.id} clicked`);
      }
    }));
  }

  /**
   * Register default Vortex services
   */
  private registerDefaultServices(): void {
    // Install mod from file
    this.registerService({
      id: 'install-mod',
      title: 'Install with Vortex',
      description: 'Install mod file with Vortex Mod Manager',
      supportedTypes: ['.zip', '.rar', '.7z', '.tar', '.gz'],
      acceptsText: false,
      acceptsFiles: true,
      handler: async (input: string | string[]) => {
        const files = Array.isArray(input) ? input : [input];
        for (const file of files) {
          await this.installModFile(file);
        }
      }
    });

    // Open mod folder
    this.registerService({
      id: 'open-mod-folder',
      title: 'Open in Vortex',
      description: 'Open folder in Vortex Mod Manager',
      supportedTypes: [],
      acceptsText: false,
      acceptsFiles: true,
      handler: async (input: string | string[]) => {
        const paths = Array.isArray(input) ? input : [input];
        for (const folderPath of paths) {
          await this.openInVortex(folderPath);
        }
      }
    });

    // Create mod from selection
    this.registerService({
      id: 'create-mod',
      title: 'Create Mod with Vortex',
      description: 'Create a new mod from selected files',
      supportedTypes: [],
      acceptsText: false,
      acceptsFiles: true,
      handler: async (input: string | string[]) => {
        const files = Array.isArray(input) ? input : [input];
        await this.createModFromFiles(files);
      }
    });

    // Share mod configuration
    this.registerService({
      id: 'share-config',
      title: 'Share Vortex Configuration',
      description: 'Share mod configuration via text',
      supportedTypes: [],
      acceptsText: true,
      acceptsFiles: false,
      handler: async (input: string | string[]) => {
        const text = Array.isArray(input) ? input.join('\n') : input;
        await this.shareConfiguration(text);
      }
    });
  }

  /**
   * Setup IPC handlers for service communication
   */
  private setupServiceHandlers(): void {
    ipcMain.handle('services:invoke', async (event, serviceId: string, input: string | string[]) => {
      await this.handleServiceInvocation(serviceId, input);
    });

    ipcMain.handle('services:list', () => {
      return this.getServices();
    });
  }

  /**
   * Setup Finder integration
   */
  private setupFinderIntegration(): void {
    if (!this.mFinderIntegration.enableContextMenu) {
      return;
    }

    // This would typically involve creating Finder Sync extensions
    // For now, we'll register the application to handle certain file types
    this.registerFileTypeHandlers();
  }

  /**
   * Register file type handlers for Finder integration
   */
  private registerFileTypeHandlers(): void {
    const supportedExtensions = new Set<string>();
    
    // Collect all supported extensions from services
    this.mServices.forEach(service => {
      service.supportedTypes.forEach(ext => supportedExtensions.add(ext));
    });

    // Register as handler for these file types
    Array.from(supportedExtensions).forEach(extension => {
      app.setAsDefaultProtocolClient(`vortex-${extension.slice(1)}`);
    });
  }

  /**
   * Update Services menu
   */
  private updateServicesMenu(): void {
    // This would update the system Services menu
    // Implementation depends on how the app integrates with the system menu
    console.log('Services menu updated');
  }

  /**
   * Update Finder integration
   */
  private updateFinderIntegration(): void {
    this.setupFinderIntegration();
  }

  /**
   * Install mod file handler
   */
  private async installModFile(filePath: string): Promise<void> {
    try {
      // Check if file exists and is a valid mod file
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const extension = path.extname(filePath).toLowerCase();
      const supportedExtensions = ['.zip', '.rar', '.7z', '.tar', '.gz'];
      
      if (!supportedExtensions.includes(extension)) {
        throw new Error(`Unsupported file type: ${extension}`);
      }

      // Bring Vortex to front
      app.focus();

      // Send install command to main window
      // This would typically trigger the mod installation process
      console.log(`Installing mod from: ${filePath}`);
      
      // TODO: Integrate with actual mod installation system
    } catch (error) {
      console.error('Failed to install mod:', error);
    }
  }

  /**
   * Open path in Vortex handler
   */
  private async openInVortex(folderPath: string): Promise<void> {
    try {
      if (!fs.existsSync(folderPath)) {
        throw new Error(`Path not found: ${folderPath}`);
      }

      // Bring Vortex to front
      app.focus();

      // Navigate to the specified path
      console.log(`Opening in Vortex: ${folderPath}`);
      
      // TODO: Integrate with actual navigation system
    } catch (error) {
      console.error('Failed to open in Vortex:', error);
    }
  }

  /**
   * Create mod from files handler
   */
  private async createModFromFiles(files: string[]): Promise<void> {
    try {
      // Validate files
      const validFiles = files.filter(file => fs.existsSync(file));
      
      if (validFiles.length === 0) {
        throw new Error('No valid files selected');
      }

      // Bring Vortex to front
      app.focus();

      // Start mod creation process
      console.log(`Creating mod from ${validFiles.length} files`);
      
      // TODO: Integrate with actual mod creation system
    } catch (error) {
      console.error('Failed to create mod:', error);
    }
  }

  /**
   * Share configuration handler
   */
  private async shareConfiguration(configText: string): Promise<void> {
    try {
      // Process configuration text
      console.log('Sharing configuration:', configText.substring(0, 100) + '...');
      
      // TODO: Integrate with actual sharing system
    } catch (error) {
      console.error('Failed to share configuration:', error);
    }
  }
}