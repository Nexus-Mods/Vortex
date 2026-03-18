import type { IMainPageOptions } from "./types/IExtensionContext";
import type { SerializableMenuItem } from "@vortex/shared/preload";

import type ExtensionManager from "../renderer/ExtensionManager";
import { debugTranslations, getMissingTranslations } from "./util/i18n";
import { log } from "./util/log";

import { webFrame } from "electron";
import * as path from "path";
import { setZoomFactor } from "./actions/window";
import { getApplication } from "./util/application";
import getVortexPath from "./util/getVortexPath";
import { getWindowId } from "./util/preloadAccess";

// Map to store click handlers by menu item ID
const menuClickHandlers: Map<string, () => void> = new Map();
let menuIdCounter = 0;

// Generate a unique menu item ID
function generateMenuId(): string {
  return `menu-item-${++menuIdCounter}`;
}

// Recursively process menu items to assign IDs and store click handlers
function processMenuTemplate(
  items: Electron.MenuItemConstructorOptions[],
): SerializableMenuItem[] {
  return items.map((item): SerializableMenuItem => {
    const processed: Omit<Electron.MenuItemConstructorOptions, "click"> = {
      ...item,
    };

    // If item has a click handler, assign an ID and store the handler
    if (item.click) {
      const id = generateMenuId();
      processed.id = id;
      menuClickHandlers.set(id, item.click as () => void);
      // Remove the click handler - it can't be serialized over IPC
      delete (processed as Electron.MenuItemConstructorOptions).click;
    }

    // Recursively process submenus
    if (item.submenu && Array.isArray(item.submenu)) {
      processed.submenu = processMenuTemplate(
        item.submenu as Electron.MenuItemConstructorOptions[],
      );
    }

    return processed as SerializableMenuItem;
  });
}

/**
 * initializes the application menu and with it, hotkeys
 *
 * @export
 * @param {ExtensionManager} extensions
 */
export function initApplicationMenu(extensions: ExtensionManager) {
  // Listen for menu click events from main process
  window.api.menu.onMenuClick((menuItemId: string) => {
    const handler = menuClickHandlers.get(menuItemId);
    if (handler) {
      handler();
    }
  });

  const changeZoomFactor = (factor: number) => {
    if (factor < 0.5 || factor > 1.5) {
      return;
    }
    factor = Math.round(factor * 10) / 10;
    extensions.getApi().sendNotification?.({
      id: "zoom-factor-changed",
      type: "info",
      message: extensions.getApi().translate("Zoom: {{factor}}%", {
        replace: { factor: Math.floor(factor * 100) },
      }),
      noDismiss: true,
      displayMS: 2000,
      localize: {
        message: false,
      },
    });
    webFrame.setZoomFactor(factor);
    extensions.getApi().store?.dispatch(setZoomFactor(factor));
  };

  const fileMenu: Electron.MenuItemConstructorOptions[] = [
    {
      label: "Close",
      click() {
        getApplication().quit();
      },
    },
  ];

  // Track translation recording state outside refresh so it persists
  let recordTranslation = false;

  const refresh = () => {
    // Clear existing handlers on refresh
    menuClickHandlers.clear();
    menuIdCounter = 0;

    const viewMenu: Electron.MenuItemConstructorOptions[] = [];

    const alreadyAssigned = new Set<string>();

    // main pages
    extensions.apply(
      "registerMainPage",
      (
        icon: string,
        title: string,
        element: any,
        options: IMainPageOptions,
      ) => {
        if (options.visible === undefined || options.visible()) {
          let accelerator =
            options.hotkeyRaw !== undefined
              ? options.hotkeyRaw
              : options.hotkey !== undefined
                ? "CmdOrCtrl+Shift+" + options.hotkey
                : undefined;

          if (options.hotkey !== undefined) {
            if (alreadyAssigned.has(options.hotkey)) {
              log("warn", "hotkey already used", { icon, title, options });
              accelerator = undefined;
            } else {
              alreadyAssigned.add(options.hotkey);
            }
          }

          viewMenu.push({
            label: title,
            visible: true,
            accelerator,
            click() {
              if (options.visible === undefined || options.visible()) {
                extensions
                  .getApi()
                  .events.emit("show-main-page", options.id || title);
              }
            },
          });
        }
      },
    );

    viewMenu.push({
      label: "Settings",
      accelerator: "CmdOrCtrl+Shift+S",
      click() {
        extensions
          .getApi()
          .events.emit("show-main-page", "application_settings");
      },
    });

    // development stuff
    if (process.env.NODE_ENV === "development") {
      viewMenu.push({ type: "separator" });
      viewMenu.push({
        label: "Toggle Developer Tools",
        accelerator:
          process.platform === "darwin" ? "Alt+Command+I" : "Ctrl+Shift+I",
        click() {
          // Toggle dev tools via IPC
          void window.api.window.toggleDevTools(getWindowId());
        },
      });

      viewMenu.push({
        label: "Reload",
        accelerator: "F5",
        click() {
          // Reload must be triggered from main process
          log("info", "Reload requested from menu");
        },
      });
      viewMenu.push({
        label: "Record missing translations",
        click() {
          recordTranslation = !recordTranslation;
          debugTranslations(recordTranslation);
          // Refresh menu to update the enabled state of "Copy missing translations"
          refresh();
        },
      });

      viewMenu.push({
        label: "Copy missing translations to clipboard",
        enabled: recordTranslation,
        click() {
          window.api.clipboard.writeText(
            JSON.stringify(getMissingTranslations(), undefined, 2),
          );
        },
      });
    }

    viewMenu.push(
      ...[
        {
          label: "Zoom In",
          accelerator: "CmdOrCtrl+Shift+Plus",
          click() {
            changeZoomFactor(webFrame.getZoomFactor() + 0.1);
          },
        },
        {
          label: "Zoom In (hidden)",
          accelerator: "CmdOrCtrl+Shift+numadd",
          visible: false,
          acceleratorWorksWhenHidden: true,
          click() {
            changeZoomFactor(webFrame.getZoomFactor() + 0.1);
          },
        },
        {
          label: "Zoom Out",
          accelerator: "CmdOrCtrl+Shift+-",
          click() {
            changeZoomFactor(webFrame.getZoomFactor() - 0.1);
          },
        },
        {
          label: "Zoom Out (hidden)",
          accelerator: "CmdOrCtrl+Shift+numsub",
          visible: false,
          acceleratorWorksWhenHidden: true,
          click() {
            changeZoomFactor(webFrame.getZoomFactor() - 0.1);
          },
        },
        {
          label: "Reset Zoom",
          accelerator: "CmdOrCtrl+0",
          click() {
            changeZoomFactor(1.0);
          },
        },
        {
          label: "Reset Zoom (hidden)",
          accelerator: "CmdOrCtrl+num0",
          visible: false,
          acceleratorWorksWhenHidden: true,
          click() {
            changeZoomFactor(1.0);
          },
        },
      ],
    );

    let profiling: boolean = false;
    const stopProfiling = () => {
      const outPath = path.join(getVortexPath("temp"), "profile.dat");
      window.api.contentTracing
        .stopRecording(outPath)
        .then(() => {
          extensions.getApi().sendNotification?.({
            id: "profiling",
            message: "Profiling done",
            type: "success",
          });
          profiling = false;
        })
        .catch(() => null);
    };

    const performanceMenu: Electron.MenuItemConstructorOptions[] = [
      {
        label: "Start/Stop Profiling",
        accelerator: "CmdOrCtrl+Shift+Alt+P",
        click() {
          if (!profiling) {
            const defaultTraceCategories: Readonly<string[]> = [
              "-*",
              "devtools.timeline",
              "disabled-by-default-devtools.timeline",
              "disabled-by-default-devtools.timeline.frame",
              "toplevel",
              "blink.console",
              "disabled-by-default-devtools.timeline.stack",
              "disabled-by-default-v8.cpu_profile",
              "disabled-by-default-v8.cpu_profiler",
              "disabled-by-default-v8.cpu_profiler.hires",
            ];

            const options = {
              categoryFilter: defaultTraceCategories.join(","),
              traceOptions: "record-until-full,enable-sampling",
              options: "sampling-frequency=10000",
            };

            window.api.contentTracing.startRecording(options).then(() => {
              console.log("Tracing started");
              extensions.getApi().sendNotification?.({
                id: "profiling",
                message: "Profiling",
                type: "activity",
                noDismiss: true,
                actions: [
                  {
                    title: "Stop (Ctrl+Shift+Alt+P)",
                    action: () => {
                      stopProfiling();
                    },
                  },
                ],
              });
              profiling = true;
            });
          } else {
            stopProfiling();
          }
        },
      },
    ];

    // Process the template to assign IDs and store handlers
    const template = processMenuTemplate([
      { label: "File", submenu: fileMenu },
      { label: "View", submenu: viewMenu },
      { label: "Performance", submenu: performanceMenu },
    ]);

    // Send the processed template (without click handlers) to main process
    void window.api.menu.setApplicationMenu(template);
  };
  refresh();
  return refresh;
}
