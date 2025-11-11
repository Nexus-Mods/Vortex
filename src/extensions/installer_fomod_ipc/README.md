# FOMOD IPC Installer

TypeScript implementation for communicating with ModInstallerIPC.exe via TCP sockets.

## Architecture

This implementation follows the C# test harness pattern from `extensions/fomod-installer/test/ModInstaller.IPC.Tests`.

### Components

#### IPCConnection.ts
Main IPC connection handler that:
- Spawns ModInstallerIPC.exe process
- Establishes TCP socket connection
- Handles message serialization/deserialization
- Manages request/response lifecycle
- Processes callbacks from the server

#### Delegates

**CoreDelegates.ts**
Implements game/mod state queries:
- `getAppVersion()` - Return Vortex version
- `getCurrentGameVersion()` - Return game version
- `getExtenderVersion()` - Check script extender version (SKSE, F4SE, etc.)
- `isExtenderPresent()` - Check if script extender is installed
- `checkIfFileExists()` - Check if file exists in game directory
- `getExistingDataFile()` - Read file from game directory
- `getExistingDataFileList()` - List files in game directory
- `getAllPlugins()` - Get list of plugins (ESP/ESM/ESL)
- `isPluginActive()` - Check if plugin is in load order
- `isPluginPresent()` - Check if plugin file exists
- `getIniString()` - Read string from INI file
- `getIniInt()` - Read integer from INI file

**UIDelegates.ts**
Implements FOMOD dialog UI callbacks:
- `startDialog()` - Initialize dialog with module name and callbacks
- `updateState()` - Update dialog with install steps
- `endDialog()` - Close/cleanup dialog
- `reportError()` - Display error to user

## Message Protocol

Messages are JSON objects delimited by `\uFFFF` character.

### Message Structure
```typescript
{
  id: string,              // Unique message ID
  payload?: {              // Request payload
    command: string,       // Command name
    ...                    // Command-specific parameters
  },
  callback?: {             // Callback metadata
    id: string,            // Request ID that sent the callback
    type: string           // Callback type
  },
  data?: any,              // Response data or callback arguments
  error?: {                // Error information
    message: string,
    stack?: string,
    name?: string
  }
}
```

### Commands

**TestSupported**
Check if files contain a FOMOD installer:
```typescript
{
  id: "abc123",
  payload: {
    command: "TestSupported",
    files: ["file1.txt", "file2.esp", "fomod/ModuleConfig.xml"],
    allowedTypes: ["XmlScript"]
  }
}
```

Response:
```typescript
{
  id: "abc123",
  data: {
    supported: true,
    requiredFiles: ["fomod/ModuleConfig.xml"]
  }
}
```

**Install**
Perform FOMOD installation:
```typescript
{
  id: "def456",
  payload: {
    command: "Install",
    files: ["file1.txt", "file2.esp", "fomod/ModuleConfig.xml"],
    stopPatterns: ["^fomod/"],
    pluginPath: null,
    scriptPath: "C:\\temp\\extract\\",
    fomodChoices: null,
    validate: true
  }
}
```

Response:
```typescript
{
  id: "def456",
  data: {
    instructions: [
      { type: "copy", source: "file1.txt", destination: "file1.txt" },
      { type: "copy", source: "file2.esp", destination: "file2.esp" }
    ]
  }
}
```

**Reply**
Reply to a callback invocation:
```typescript
{
  id: "xyz789",
  payload: {
    command: "Reply",
    request: { id: "callback_msg_id" },
    data: "result data",
    error: null
  }
}
```

**Quit**
Terminate the IPC connection:
```typescript
{
  id: "quit123",
  payload: {
    command: "Quit"
  }
}
```

### Callback Flow

1. Client sends Install command
2. Server invokes callbacks during installation:
   ```typescript
   {
     id: "callback_msg_1",
     callback: { id: "def456", type: "context" },
     data: {
       name: "getAppVersion",
       args: []
     }
   }
   ```
3. Client executes callback and sends Reply:
   ```typescript
   {
     id: "reply_1",
     payload: {
       command: "Reply",
       request: { id: "callback_msg_1" },
       data: "1.0.0",
       error: null
     }
   }
   ```
4. Server continues processing and eventually sends final response

## Implementation Status

### ✅ Completed
- TCP socket communication
- Message serialization/deserialization
- Request/response handling
- Callback registration and invocation
- Process lifecycle management
- TestSupported command
- Install command
- Error handling

### ❌ TODO (Empty Implementations)
All delegate methods are stubbed with `log('debug', ...)` calls. You need to implement:

**CoreDelegates**
- [ ] `getAppVersion()` - Read from Vortex version
- [ ] `getCurrentGameVersion()` - Query game discovery
- [ ] `getExtenderVersion()` - Check for SKSE/F4SE/etc
- [ ] `isExtenderPresent()` - Check if extender installed
- [ ] `checkIfFileExists()` - Check game data directory
- [ ] `getExistingDataFile()` - Read from game data
- [ ] `getExistingDataFileList()` - List game data files
- [ ] `getAllPlugins()` - Get plugins from load order
- [ ] `isPluginActive()` - Check load order
- [ ] `isPluginPresent()` - Check if plugin exists
- [ ] `getIniString()` - Parse INI files
- [ ] `getIniInt()` - Parse INI files

**UIDelegates**
- [ ] `startDialog()` - Show FOMOD dialog UI
- [ ] `updateState()` - Update dialog with steps
- [ ] `endDialog()` - Close dialog
- [ ] `reportError()` - Show error notification
- [ ] Implement callback invocation through IPCConnection

**Index**
- [ ] Determine game-specific stop patterns
- [ ] Determine plugin path per game
- [ ] Transform install result to IInstallResult format
- [ ] Add game-specific logic

## Testing

Reference the C# test implementation:
```
extensions/fomod-installer/test/ModInstaller.IPC.Tests/
├── TestSupportedTests.cs
├── InstallTests.cs
├── Utils/IPCTestHarness.cs
└── Delegates/
    ├── IPCDelegates.cs
    └── IPCUIHandler.cs
```

## Differences from Previous Implementation

This implementation (`installer_fomod_ipc`) differs from the old implementation (`installer_fomod`):

1. **Direct TCP communication** - No intermediate wrapper packages
2. **Simpler message format** - Standard JSON with delimiter
3. **Cleaner separation** - Delegates in separate files
4. **No Edge.js dependency** - Pure Node.js socket communication
5. **Process management** - Better lifecycle handling
6. **Type safety** - Full TypeScript types for messages

## Architecture Refactoring (2025-01)

The IPC connection system has been refactored into a two-layer architecture:

### Layer 1: BaseIPCConnection (Generic)

**File**: [BaseIPCConnection.ts](./BaseIPCConnection.ts)

Generic, framework-agnostic IPC connection class that can be used in any Node.js environment.

**Key Features**:
- Transport and launcher strategy management
- Message sending/receiving and protocol handling
- Timeout management with pluggable dialog handlers
- Process lifecycle management
- Callback registration system
- Connection fallback strategies

**Abstract Methods** (must be implemented by derived classes):
```typescript
protected abstract log(level: 'debug' | 'info' | 'warn' | 'error', message: string, metadata?: any): void;
protected abstract fileExists(filePath: string): Promise<boolean>;
protected abstract getExecutablePaths(exeName: string): string[];
```

**No Vortex dependencies** - Can be used in:
- Console applications
- Different Electron apps
- Web applications with Node.js backend
- Testing frameworks with mocked implementations

### Layer 2: VortexIPCConnection (Vortex-Specific)

**File**: [VortexIPCConnection.ts](./VortexIPCConnection.ts)

Extends `BaseIPCConnection` with Vortex-specific integrations.

**Vortex Integrations**:
- Logging via `log()` from `../../util/log`
- File system via `fs` from `../..`
- Path resolution via `getVortexPath()` from `../../util/getVortexPath`
- User dialogs via `api.showDialog()` and `api.closeDialog()`
- Translations via `api.translate()`

**FOMOD-Specific Methods**:
```typescript
public async testSupported(files: string[], allowedTypes: string[]): Promise<ISupportedResult>
public async install(...): Promise<IInstallResult>
```

### Benefits of This Architecture

1. **Separation of Concerns** - Core IPC logic independent of Vortex
2. **Reusability** - Base class can be used in other projects
3. **Maintainability** - Clear separation makes code easier to understand
4. **Testability** - Base class can be tested with minimal mocking
5. **Extensibility** - Easy to add framework-specific features

### Extending for Other Frameworks

To use this IPC system in a different framework:

```typescript
import { BaseIPCConnection, ConnectionStrategy } from './BaseIPCConnection';

export class MyFrameworkIPCConnection extends BaseIPCConnection {
  protected log(level: string, message: string, metadata?: any): void {
    myFrameworkLogger.log(level, message, metadata);
  }

  protected async fileExists(filePath: string): Promise<boolean> {
    return await myFrameworkFS.exists(filePath);
  }

  protected getExecutablePaths(exeName: string): string[] {
    return [
      path.join(myFrameworkPaths.base, 'bin', exeName),
      // ... more paths
    ];
  }

  // Add framework-specific methods
  public async myCustomCommand(data: any): Promise<any> {
    return await this.sendCommand('MyCustomCommand', data);
  }
}
```

### Migration Notes

The original `IPCConnection.ts` class has been split into:
- Generic functionality → `BaseIPCConnection.ts`
- Vortex-specific functionality → `VortexIPCConnection.ts`

All existing code now uses `VortexIPCConnection`. The API remains the same, so no changes to calling code were needed.

**Deprecated**: `IPCConnection.ts` (can be removed once migration is verified)

## References

- C# IPC Implementation: `extensions/fomod-installer/src/ModInstaller.IPC/`
- C# Test Harness: `extensions/fomod-installer/test/ModInstaller.IPC.Tests/`
- Old TypeScript Implementation: `src/extensions/installer_fomod/` (will be removed)
