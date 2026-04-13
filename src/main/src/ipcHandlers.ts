/**
 * IPC handlers for main process.
 * These handlers respond to requests from the renderer process via preload.
 */

import type { VortexPaths } from "@vortex/shared/ipc";
import type { SerializableMenuItem } from "@vortex/shared/preload";
import type {
  IpcMainInvokeEvent,
  JumpListCategory,
  OpenDialogOptions,
  SaveDialogOptions,
  Settings,
  TraceConfig,
  TraceCategoriesAndOptions,
} from "electron";

import {
  app,
  BrowserWindow,
  clipboard,
  contentTracing,
  dialog,
  Menu,
  powerSaveBlocker,
  WebContentsView,
} from "electron";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { relaunch } from "./cli";
import { getVortexPath } from "./getVortexPath";
import { betterIpcMain } from "./ipc";
import { openUrl, openFile } from "./open";
import { extraWebViews } from "./webview";

// Type-safe interface for global Redux state accessors
export interface GlobalWithRedux {
  getReduxState?: () => object;
  getReduxStateMsgpack?: (idx: number) => string;
}

export function init() {
  // Build paths lazily so that paths overridden later (e.g. "temp" in
  // Application constructor) are resolved at call time, not at init time.
  function resolveVortexPaths(): VortexPaths {
    const paths: VortexPaths = {
      base: getVortexPath("base"),
      base_unpacked: getVortexPath("base_unpacked"),
      assets: getVortexPath("assets"),
      assets_unpacked: getVortexPath("assets_unpacked"),
      modules: getVortexPath("modules"),
      modules_unpacked: getVortexPath("modules_unpacked"),
      bundledPlugins: getVortexPath("bundledPlugins"),
      locales: getVortexPath("locales"),
      package: getVortexPath("package"),
      package_unpacked: getVortexPath("package_unpacked"),
      application: getVortexPath("application"),
      userData: getVortexPath("userData"),
      appData: getVortexPath("appData"),
      localAppData: getVortexPath("localAppData"),
      temp: getVortexPath("temp"),
      home: getVortexPath("home"),
      documents: getVortexPath("documents"),
      exe: getVortexPath("exe"),
      desktop: getVortexPath("desktop"),
    };

    // Normalize all paths to use consistent separators. This is necessary
    // because the scoped package name "@vortex/main" contains a forward slash
    // which Electron preserves in app.getPath("userData"), producing mixed
    // separators that break symlink detection (readlink returns OS-normalized paths).
    for (const [key, value] of Object.entries(paths)) {
      paths[key] = path.normalize(value);
    }

    return paths;
  }

  // ============================================================================
  // Example handler
  // ============================================================================

  betterIpcMain.handle("example:ping", () => "pong", { includeArgs: true });

  // ============================================================================
  // Helper functions
  // ============================================================================

  /**
   * Returns the executable path and arguments for protocol client registration.
   */
  function selfCL(udPath: string | undefined): [string, string[]] {
    // The "-d" flag is required so that when Windows appends the NXM URL to the command line,
    // it becomes "-d nxm://..." which commander parses as "--download nxm://..."
    if (process.env.NODE_ENV === "development") {
      // Use absolute path for the app entry point - process.argv[1] may be relative (e.g. ".")
      // and would fail when launched from a different working directory (e.g. C:\WINDOWS\system32)
      const appPath = path.resolve(process.argv[1]);
      return [
        process.execPath,
        [
          appPath,
          ...(udPath !== undefined ? ["--userData", udPath] : []),
          "-d",
        ],
      ];
    } else {
      return [
        process.execPath,
        [...(udPath !== undefined ? ["--userData", udPath] : []), "-d"],
      ];
    }
  }

  // ============================================================================
  // Dialog handlers
  // ============================================================================

  betterIpcMain.handle(
    "dialog:showOpen",
    async (event: IpcMainInvokeEvent, options: OpenDialogOptions) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      return await dialog.showOpenDialog(window, options);
    },
  );

  betterIpcMain.handle(
    "dialog:showSave",
    async (event: IpcMainInvokeEvent, options: SaveDialogOptions) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      return await dialog.showSaveDialog(window, options);
    },
  );

  betterIpcMain.handle(
    "dialog:showMessageBox",
    async (event: IpcMainInvokeEvent, options: Electron.MessageBoxOptions) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      return await dialog.showMessageBox(window, options);
    },
  );

  betterIpcMain.handle(
    "dialog:showErrorBox",
    (_event: IpcMainInvokeEvent, title: string, content: string) => {
      console.error("[Error Box]", title, content);
      dialog.showErrorBox(title, content);
    },
  );

  // ============================================================================
  // App protocol client handlers
  // ============================================================================

  betterIpcMain.handle(
    "app:setProtocolClient",
    (
      _event: IpcMainInvokeEvent,
      protocol: string,
      udPath: string | undefined,
    ) => {
      const [execPath, args] = selfCL(udPath);
      app.setAsDefaultProtocolClient(protocol, execPath, args);
    },
  );

  betterIpcMain.handle(
    "app:isProtocolClient",
    (
      _event: IpcMainInvokeEvent,
      protocol: string,
      udPath: string | undefined,
    ) => {
      const [execPath, args] = selfCL(udPath);
      return app.isDefaultProtocolClient(protocol, execPath, args);
    },
  );

  betterIpcMain.handle(
    "app:removeProtocolClient",
    (
      _event: IpcMainInvokeEvent,
      protocol: string,
      udPath: string | undefined,
    ) => {
      const [execPath, args] = selfCL(udPath);
      app.removeAsDefaultProtocolClient(protocol, execPath, args);
    },
  );

  betterIpcMain.handle(
    "app:exit",
    (_event: IpcMainInvokeEvent, exitCode: number) => {
      app.exit(exitCode);
    },
  );

  // Shell
  betterIpcMain.on("shell:openUrl", (_event, url) => {
    openUrl(new URL(url));
  });

  betterIpcMain.on("shell:openFile", (_event, filePath) => {
    openFile(filePath);
  });

  // ============================================================================
  // App info handlers
  // ============================================================================

  betterIpcMain.on("app:relaunch", (_event, args) => {
    relaunch(args);
  });

  betterIpcMain.handle("app:getName", () => {
    return app.getName();
  });

  betterIpcMain.handle("app:getPath", (_event: IpcMainInvokeEvent, name) => {
    return getVortexPath(name);
  });

  betterIpcMain.handle(
    "app:extractFileIcon",
    async (_event: IpcMainInvokeEvent, exePath: string, iconPath: string) => {
      const icon = await app.getFileIcon(exePath, { size: "normal" });
      await writeFile(iconPath, icon.toPNG());
    },
  );

  betterIpcMain.handle("app:getAppPath", (_event: IpcMainInvokeEvent) => {
    return app.getAppPath();
  });

  betterIpcMain.handle("app:getVersion", () => {
    return app.getVersion();
  });

  betterIpcMain.handle("app:getVortexPaths", () => {
    return resolveVortexPaths();
  });

  // ============================================================================
  // WebContentsView handlers (migrated from BrowserView, removed in Electron 39)
  // ============================================================================

  betterIpcMain.handle(
    "browserView:create",
    async (
      event: IpcMainInvokeEvent,
      src: string,
      partition: string,
      _isNexus: boolean,
    ) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      const contentsId = event.sender.id;

      if (extraWebViews[contentsId] === undefined) {
        extraWebViews[contentsId] = {};
      }

      const view = new WebContentsView({
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          partition: partition,
          sandbox: true,
          webSecurity: false,
        },
      });
      view.setBackgroundColor("#00000000");

      const viewId = `${contentsId}_${Object.keys(extraWebViews[contentsId]).length}`;
      extraWebViews[contentsId][viewId] = view;

      await view.webContents.loadURL(src);
      window?.contentView.addChildView(view);

      return viewId;
    },
  );

  betterIpcMain.handle(
    "browserView:createWithEvents",
    async (
      event: IpcMainInvokeEvent,
      src: string,
      forwardEvents: string[],
      options: Electron.WebContentsViewConstructorOptions | undefined,
    ) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      const contentsId = event.sender.id;

      if (extraWebViews[contentsId] === undefined) {
        extraWebViews[contentsId] = {};
      }

      const typedOptions = options ?? {};
      const viewOptions: Electron.WebContentsViewConstructorOptions = {
        ...typedOptions,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: false,
          ...typedOptions?.webPreferences,
        },
      };

      const view = new WebContentsView(viewOptions);
      view.setBackgroundColor("#00000000");

      const viewId = `${contentsId}_${Object.keys(extraWebViews[contentsId]).length}`;
      extraWebViews[contentsId][viewId] = view;

      // Manual auto-resize: update view bounds when window resizes
      const updateBounds = () => {
        if (window && !window.isDestroyed()) {
          const bounds = window.getContentBounds();
          view.setBounds({
            x: 0,
            y: 0,
            width: bounds.width,
            height: bounds.height,
          });
        }
      };
      window?.on("resize", updateBounds);

      window?.contentView.addChildView(view);
      await view.webContents.loadURL(src);

      // Forward events from WebContentsView to renderer
      forwardEvents.forEach((eventId) => {
        view.webContents.on(
          eventId as Parameters<typeof view.webContents.on>[0],
          (evt, ...args) => {
            event.sender.send(
              `view-${viewId}-${eventId}`,
              JSON.stringify(args),
            );
            evt.preventDefault();
          },
        );
      });

      return viewId;
    },
  );

  betterIpcMain.handle(
    "browserView:close",
    (event: IpcMainInvokeEvent, viewId: string) => {
      const contentsId = event.sender.id;
      if (extraWebViews[contentsId]?.[viewId] !== undefined) {
        const window = BrowserWindow.fromWebContents(event.sender);
        window?.contentView.removeChildView(extraWebViews[contentsId][viewId]);
        delete extraWebViews[contentsId][viewId];
      }
    },
  );

  betterIpcMain.handle(
    "browserView:position",
    (event: IpcMainInvokeEvent, viewId: string, rect: Electron.Rectangle) => {
      const contentsId = event.sender.id;
      extraWebViews[contentsId]?.[viewId]?.setBounds?.(rect);
    },
  );

  betterIpcMain.handle(
    "browserView:updateURL",
    (event: IpcMainInvokeEvent, viewId: string, newURL: string) => {
      const contentsId = event.sender.id;
      void extraWebViews[contentsId]?.[viewId]?.webContents.loadURL(newURL);
    },
  );

  // ============================================================================
  // Jump list (Windows)
  // ============================================================================

  betterIpcMain.handle(
    "app:setJumpList",
    (_event: IpcMainInvokeEvent, categories: JumpListCategory[]) => {
      try {
        app.setJumpList(categories);
      } catch (_err) {
        // Ignore jump list errors (not available on all platforms)
      }
    },
  );

  // ============================================================================
  // Session cookies
  // ============================================================================

  betterIpcMain.handle(
    "session:getCookies",
    async (event: IpcMainInvokeEvent, filter: Electron.CookiesGetFilter) => {
      return event.sender.session.cookies.get(filter);
    },
  );

  // ============================================================================
  // Window operations
  // ============================================================================

  betterIpcMain.handle("window:getId", (event: IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return window?.id ?? -1;
  });

  betterIpcMain.handle(
    "window:minimize",
    (_event: IpcMainInvokeEvent, windowId: number) => {
      const window = BrowserWindow.fromId(windowId);
      window?.minimize();
    },
  );

  betterIpcMain.handle(
    "window:maximize",
    (_event: IpcMainInvokeEvent, windowId: number) => {
      const window = BrowserWindow.fromId(windowId);
      window?.maximize();
    },
  );

  betterIpcMain.handle(
    "window:unmaximize",
    (_event: IpcMainInvokeEvent, windowId: number) => {
      const window = BrowserWindow.fromId(windowId);
      window?.unmaximize();
    },
  );

  betterIpcMain.handle(
    "window:restore",
    (_event: IpcMainInvokeEvent, windowId: number) => {
      const window = BrowserWindow.fromId(windowId);
      window?.restore();
    },
  );

  betterIpcMain.handle(
    "window:close",
    (_event: IpcMainInvokeEvent, windowId: number) => {
      const window = BrowserWindow.fromId(windowId);
      window?.close();
    },
  );

  betterIpcMain.handle(
    "window:focus",
    (_event: IpcMainInvokeEvent, windowId: number) => {
      const window = BrowserWindow.fromId(windowId);
      window?.focus();
    },
  );

  betterIpcMain.handle(
    "window:show",
    (_event: IpcMainInvokeEvent, windowId: number) => {
      if (process.env.VORTEX_E2E_HEADLESS !== "1") {
        const window = BrowserWindow.fromId(windowId);
        window?.show();
      }
    },
  );

  betterIpcMain.handle(
    "window:hide",
    (_event: IpcMainInvokeEvent, windowId: number) => {
      const window = BrowserWindow.fromId(windowId);
      window?.hide();
    },
  );

  betterIpcMain.handle(
    "window:isMaximized",
    (_event: IpcMainInvokeEvent, windowId: number) => {
      const window = BrowserWindow.fromId(windowId);
      return window?.isMaximized() ?? false;
    },
  );

  betterIpcMain.handle(
    "window:isMinimized",
    (_event: IpcMainInvokeEvent, windowId: number) => {
      const window = BrowserWindow.fromId(windowId);
      return window?.isMinimized() ?? false;
    },
  );

  betterIpcMain.handle(
    "window:isFocused",
    (_event: IpcMainInvokeEvent, windowId: number) => {
      const window = BrowserWindow.fromId(windowId);
      return window?.isFocused() ?? false;
    },
  );

  betterIpcMain.handle(
    "window:setAlwaysOnTop",
    (_event: IpcMainInvokeEvent, windowId: number, flag: boolean) => {
      const window = BrowserWindow.fromId(windowId);
      window?.setAlwaysOnTop(flag);
    },
  );

  betterIpcMain.handle(
    "window:moveTop",
    (_event: IpcMainInvokeEvent, windowId: number) => {
      const window = BrowserWindow.fromId(windowId);
      window?.moveTop();
    },
  );

  betterIpcMain.handle(
    "window:getPosition",
    (_event: IpcMainInvokeEvent, windowId: number) => {
      const win = BrowserWindow.fromId(windowId);
      return (win?.getPosition() ?? [0, 0]) as [number, number];
    },
  );

  betterIpcMain.handle(
    "window:setPosition",
    (_event: IpcMainInvokeEvent, windowId: number, x: number, y: number) => {
      const win = BrowserWindow.fromId(windowId);
      win?.setPosition(x, y);
    },
  );

  betterIpcMain.handle(
    "window:getSize",
    (_event: IpcMainInvokeEvent, windowId: number) => {
      const win = BrowserWindow.fromId(windowId);
      return (win?.getSize() ?? [0, 0]) as [number, number];
    },
  );

  betterIpcMain.handle(
    "window:setSize",
    (
      _event: IpcMainInvokeEvent,
      windowId: number,
      width: number,
      height: number,
    ) => {
      const win = BrowserWindow.fromId(windowId);
      win?.setSize(width, height);
    },
  );

  betterIpcMain.handle(
    "window:isVisible",
    (_event: IpcMainInvokeEvent, windowId: number) => {
      const win = BrowserWindow.fromId(windowId);
      return win?.isVisible() ?? false;
    },
  );

  betterIpcMain.handle(
    "window:toggleDevTools",
    (_event: IpcMainInvokeEvent, windowId: number) => {
      const win = BrowserWindow.fromId(windowId);
      win?.webContents.toggleDevTools();
    },
  );

  // ============================================================================
  // Content tracing operations
  // ============================================================================

  betterIpcMain.handle(
    "contentTracing:startRecording",
    async (
      _event: IpcMainInvokeEvent,
      options: TraceConfig | TraceCategoriesAndOptions,
    ) => {
      return await contentTracing.startRecording(options);
    },
  );

  betterIpcMain.handle(
    "contentTracing:stopRecording",
    async (_event: IpcMainInvokeEvent, resultPath: string) => {
      return await contentTracing.stopRecording(resultPath);
    },
  );

  // ============================================================================
  // Redux state transfer
  // ============================================================================

  betterIpcMain.handle("redux:getState", () => {
    const getReduxState = (global as GlobalWithRedux).getReduxState;
    if (typeof getReduxState === "function") {
      return getReduxState();
    }
    return undefined;
  });

  betterIpcMain.handle(
    "redux:getStateMsgpack",
    (_event: IpcMainInvokeEvent, idx: number) => {
      const getReduxStateMsgpack = (global as GlobalWithRedux)
        .getReduxStateMsgpack;
      if (typeof getReduxStateMsgpack === "function") {
        return getReduxStateMsgpack(idx ?? 0);
      }
      return undefined;
    },
  );

  // ============================================================================
  // Login item settings
  // ============================================================================

  betterIpcMain.handle(
    "app:setLoginItemSettings",
    (_event: IpcMainInvokeEvent, settings: Settings) => {
      app.setLoginItemSettings(settings);
    },
  );

  betterIpcMain.handle("app:getLoginItemSettings", () => {
    return app.getLoginItemSettings();
  });

  // ============================================================================
  // Clipboard operations
  // ============================================================================

  betterIpcMain.handle(
    "clipboard:writeText",
    (_event: IpcMainInvokeEvent, text: string) => {
      clipboard.writeText(text);
    },
  );

  betterIpcMain.handle("clipboard:readText", () => {
    return clipboard.readText();
  });

  // ============================================================================
  // Menu operations
  // ============================================================================

  betterIpcMain.handle(
    "menu:setApplicationMenu",
    (event: IpcMainInvokeEvent, template: SerializableMenuItem[]) => {
      const processTemplate = (
        items: SerializableMenuItem[],
      ): Electron.MenuItemConstructorOptions[] => {
        return items.map((item): Electron.MenuItemConstructorOptions => {
          const processed: Electron.MenuItemConstructorOptions = { ...item };

          // If item has an ID (from renderer's processMenuTemplate), add a click handler
          if (item.id) {
            processed.click = () => {
              event.sender.send("menu:click", item.id);
            };
          }

          // Process submenus recursively
          if (item.submenu && Array.isArray(item.submenu)) {
            processed.submenu = processTemplate(item.submenu);
          }

          return processed;
        });
      };

      const menu = Menu.buildFromTemplate(processTemplate(template));
      Menu.setApplicationMenu(menu);
    },
  );

  // ============================================================================
  // Power save blocker
  // ============================================================================

  betterIpcMain.handle(
    "powerSaveBlocker:start",
    (
      _event: IpcMainInvokeEvent,
      type: "prevent-app-suspension" | "prevent-display-sleep",
    ) => {
      return powerSaveBlocker.start(type);
    },
  );

  betterIpcMain.handle(
    "powerSaveBlocker:stop",
    (_event: IpcMainInvokeEvent, id: number) => {
      powerSaveBlocker.stop(id);
    },
  );

  betterIpcMain.handle(
    "powerSaveBlocker:isStarted",
    (_event: IpcMainInvokeEvent, id: number) => {
      return powerSaveBlocker.isStarted(id);
    },
  );
}
