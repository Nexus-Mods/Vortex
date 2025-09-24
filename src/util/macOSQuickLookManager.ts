import { app, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Interface for Quick Look preview options
 */
interface IQuickLookOptions {
  /** File path to preview */
  filePath: string;
  /** Optional title for the preview */
  title?: string;
  /** Whether to show file info */
  showInfo?: boolean;
  /** Custom icon path */
  iconPath?: string;
}

/**
 * Interface for supported file types
 */
interface ISupportedFileType {
  /** File extensions */
  extensions: string[];
  /** MIME type */
  mimeType: string;
  /** Description */
  description: string;
  /** Whether it supports thumbnail generation */
  supportsThumbnail: boolean;
}

/**
 * Manager for macOS Quick Look integration
 * Provides preview support for mod files and game assets
 */
export class MacOSQuickLookManager {
  private mInitialized: boolean = false;
  private mSupportedTypes: ISupportedFileType[] = [];

  constructor() {
    this.initializeSupportedTypes();
  }

  /**
   * Initialize the Quick Look manager
   */
  public initialize(): void {
    if (this.mInitialized || process.platform !== 'darwin') {
      return;
    }

    try {
      this.registerQuickLookHandlers();
      this.mInitialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize Quick Look manager:', error);
    }
  }

  /**
   * Show Quick Look preview for a file
   */
  public async showPreview(options: IQuickLookOptions): Promise<void> {
    if (!this.mInitialized) {
      return;
    }

    try {
      const { filePath } = options;
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Use macOS Quick Look via shell
      await shell.openPath(filePath);
    } catch (error) {
      console.error('❌ Failed to show Quick Look preview:', error);
      // Fallback to opening with default application
      await shell.openPath(options.filePath);
    }
  }

  /**
   * Generate thumbnail for supported file types
   */
  public async generateThumbnail(filePath: string, outputPath: string, size: number = 256): Promise<boolean> {
    if (!this.mInitialized) {
      return false;
    }

    try {
      const fileType = this.getFileType(filePath);
      if (!fileType?.supportsThumbnail) {
        return false;
      }

      // Use macOS qlmanage to generate thumbnail
      const { spawn } = require('child_process');
      
      return new Promise((resolve) => {
        const qlmanage = spawn('qlmanage', [
          '-t',
          '-s', size.toString(),
          '-o', path.dirname(outputPath),
          filePath
        ]);

        qlmanage.on('close', (code) => {
          resolve(code === 0);
        });

        qlmanage.on('error', () => {
          resolve(false);
        });
      });
    } catch (error) {
      console.error('❌ Failed to generate thumbnail:', error);
      return false;
    }
  }

  /**
   * Check if a file type is supported for Quick Look
   */
  public isSupported(filePath: string): boolean {
    const fileType = this.getFileType(filePath);
    return fileType !== null;
  }

  /**
   * Get file type information
   */
  public getFileType(filePath: string): ISupportedFileType | null {
    const extension = path.extname(filePath).toLowerCase();
    return this.mSupportedTypes.find(type => 
      type.extensions.includes(extension)
    ) || null;
  }

  /**
   * Add custom file type support
   */
  public addFileTypeSupport(fileType: ISupportedFileType): void {
    this.mSupportedTypes.push(fileType);
  }

  /**
   * Get all supported file types
   */
  public getSupportedTypes(): ISupportedFileType[] {
    return [...this.mSupportedTypes];
  }

  /**
   * Create Quick Look preview for mod metadata
   */
  public async createModPreview(modPath: string, metadata: any): Promise<string> {
    if (!this.mInitialized) {
      return '';
    }

    try {
      const previewPath = path.join(app.getPath('temp'), `mod_preview_${Date.now()}.html`);
      
      const htmlContent = this.generateModPreviewHTML(metadata, modPath);
      fs.writeFileSync(previewPath, htmlContent, 'utf8');
      
      return previewPath;
    } catch (error) {
      console.error('❌ Failed to create mod preview:', error);
      return '';
    }
  }

  /**
   * Initialize supported file types
   */
  private initializeSupportedTypes(): void {
    this.mSupportedTypes = [
      // Archive formats
      {
        extensions: ['.zip', '.rar', '.7z', '.tar', '.gz'],
        mimeType: 'application/zip',
        description: 'Archive files',
        supportsThumbnail: false
      },
      // Image formats
      {
        extensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.dds', '.tga'],
        mimeType: 'image/*',
        description: 'Image files',
        supportsThumbnail: true
      },
      // Text formats
      {
        extensions: ['.txt', '.md', '.json', '.xml', '.ini', '.cfg', '.log'],
        mimeType: 'text/plain',
        description: 'Text files',
        supportsThumbnail: true
      },
      // Mod-specific formats
      {
        extensions: ['.esp', '.esm', '.esl'],
        mimeType: 'application/octet-stream',
        description: 'Elder Scrolls Plugin files',
        supportsThumbnail: false
      },
      // Game asset formats
      {
        extensions: ['.nif', '.dds', '.bsa', '.ba2'],
        mimeType: 'application/octet-stream',
        description: 'Game asset files',
        supportsThumbnail: false
      },
      // Audio formats
      {
        extensions: ['.mp3', '.wav', '.ogg', '.flac', '.xwm'],
        mimeType: 'audio/*',
        description: 'Audio files',
        supportsThumbnail: true
      },
      // Video formats
      {
        extensions: ['.mp4', '.avi', '.mkv', '.mov', '.bik'],
        mimeType: 'video/*',
        description: 'Video files',
        supportsThumbnail: true
      }
    ];
  }

  /**
   * Register Quick Look handlers
   */
  private registerQuickLookHandlers(): void {
    // Register file associations for better Quick Look integration
    // This would typically be done in the app's Info.plist
    console.log('🔍 Quick Look handlers registered for supported file types');
  }

  /**
   * Generate HTML preview for mod metadata
   */
  private generateModPreviewHTML(metadata: any, modPath: string): string {
    const modName = metadata.name || path.basename(modPath);
    const version = metadata.version || 'Unknown';
    const author = metadata.author || 'Unknown';
    const description = metadata.description || 'No description available';
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Mod Preview: ${modName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 20px;
            background: #f5f5f5;
            color: #333;
        }
        .container {
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            border-bottom: 1px solid #eee;
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        .mod-name {
            font-size: 24px;
            font-weight: bold;
            color: #007AFF;
            margin: 0;
        }
        .mod-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 20px;
        }
        .info-item {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 4px;
        }
        .info-label {
            font-weight: bold;
            color: #666;
            font-size: 12px;
            text-transform: uppercase;
        }
        .info-value {
            margin-top: 5px;
            font-size: 14px;
        }
        .description {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            border-left: 4px solid #007AFF;
        }
        .path {
            font-family: Monaco, 'Courier New', monospace;
            font-size: 11px;
            color: #666;
            background: #f0f0f0;
            padding: 8px;
            border-radius: 4px;
            margin-top: 15px;
            word-break: break-all;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="mod-name">${modName}</h1>
        </div>
        
        <div class="mod-info">
            <div class="info-item">
                <div class="info-label">Version</div>
                <div class="info-value">${version}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Author</div>
                <div class="info-value">${author}</div>
            </div>
        </div>
        
        <div class="description">
            <div class="info-label">Description</div>
            <div style="margin-top: 10px;">${description}</div>
        </div>
        
        <div class="path">
            <strong>Path:</strong> ${modPath}
        </div>
    </div>
</body>
</html>`;
  }
}