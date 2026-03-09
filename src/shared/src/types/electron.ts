/**
 * Minimal duplicates of Electron types used in IPC channel definitions.
 *
 * The shared folder cannot import NodeJS modules, so we duplicate the specific
 * Electron types referenced in ipc.ts and preload.ts here. These are
 * compile-time only and must stay in sync with the Electron version used by
 * the project.
 */

export interface FileFilter {
  extensions: string[];
  name: string;
}

export interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: FileFilter[];
  properties?: Array<
    | "openFile"
    | "openDirectory"
    | "multiSelections"
    | "showHiddenFiles"
    | "createDirectory"
    | "promptToCreate"
    | "noResolveAliases"
    | "treatPackageAsDirectory"
    | "dontAddToRecent"
  >;
  message?: string;
  securityScopedBookmarks?: boolean;
}

export interface OpenDialogReturnValue {
  canceled: boolean;
  filePaths: string[];
  bookmarks?: string[];
}

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: FileFilter[];
  message?: string;
  nameFieldLabel?: string;
  showsTagField?: boolean;
  properties?: Array<
    | "showHiddenFiles"
    | "createDirectory"
    | "treatPackageAsDirectory"
    | "showOverwriteConfirmation"
    | "dontAddToRecent"
  >;
  securityScopedBookmarks?: boolean;
}

export interface SaveDialogReturnValue {
  canceled: boolean;
  filePath: string;
  bookmark?: string;
}

export interface MessageBoxOptions {
  message: string;
  type?: "none" | "info" | "error" | "question" | "warning";
  buttons?: string[];
  defaultId?: number;
  title?: string;
  detail?: string;
  checkboxLabel?: string;
  checkboxChecked?: boolean;
  textWidth?: number;
  cancelId?: number;
  noLink?: boolean;
  normalizeAccessKeys?: boolean;
}

export interface MessageBoxReturnValue {
  response: number;
  checkboxChecked: boolean;
}

export interface DefaultFontFamily {
  standard?: string;
  serif?: string;
  sansSerif?: string;
  monospace?: string;
  cursive?: string;
  fantasy?: string;
  math?: string;
}

export interface Offscreen {
  useSharedTexture?: boolean;
}

export interface WebPreferences {
  accessibleTitle?: string;
  additionalArguments?: string[];
  allowRunningInsecureContent?: boolean;
  autoplayPolicy?:
    | "no-user-gesture-required"
    | "user-gesture-required"
    | "document-user-activation-required";
  backgroundThrottling?: boolean;
  contextIsolation?: boolean;
  defaultEncoding?: string;
  defaultFontFamily?: DefaultFontFamily;
  defaultFontSize?: number;
  defaultMonospaceFontSize?: number;
  devTools?: boolean;
  disableBlinkFeatures?: string;
  disableDialogs?: boolean;
  disableHtmlFullscreenWindowResize?: boolean;
  enableBlinkFeatures?: string;
  enablePreferredSizeMode?: boolean;
  enableWebSQL?: boolean;
  experimentalFeatures?: boolean;
  imageAnimationPolicy?: "animate" | "animateOnce" | "noAnimation";
  images?: boolean;
  javascript?: boolean;
  minimumFontSize?: number;
  navigateOnDragDrop?: boolean;
  nodeIntegration?: boolean;
  nodeIntegrationInSubFrames?: boolean;
  nodeIntegrationInWorker?: boolean;
  offscreen?: Offscreen | boolean;
  partition?: string;
  plugins?: boolean;
  preload?: string;
  safeDialogs?: boolean;
  safeDialogsMessage?: string;
  sandbox?: boolean;
  scrollBounce?: boolean;
  // Session omitted: not serializable over IPC (class instance)
  spellcheck?: boolean;
  textAreasAreResizable?: boolean;
  transparent?: boolean;
  v8CacheOptions?:
    | "none"
    | "code"
    | "bypassHeatCheck"
    | "bypassHeatCheckAndEagerCompile";
  webgl?: boolean;
  webSecurity?: boolean;
  webviewTag?: boolean;
  zoomFactor?: number;
  /** @deprecated */
  enableDeprecatedPaste?: boolean;
}

export interface BrowserViewConstructorOptions {
  webPreferences?: WebPreferences;
}

export interface JumpListItem {
  args?: string;
  description?: string;
  iconIndex?: number;
  iconPath?: string;
  path?: string;
  program?: string;
  title?: string;
  type?: "task" | "separator" | "file";
  workingDirectory?: string;
}

export interface JumpListCategory {
  items?: JumpListItem[];
  name?: string;
  type?: "tasks" | "frequent" | "recent" | "custom";
}

export interface CookiesGetFilter {
  url?: string;
  name?: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  session?: boolean;
  httpOnly?: boolean;
}

export interface Cookie {
  domain?: string;
  expirationDate?: number;
  hostOnly?: boolean;
  httpOnly?: boolean;
  name: string;
  path?: string;
  sameSite: "unspecified" | "no_restriction" | "lax" | "strict";
  secure?: boolean;
  session?: boolean;
  value: string;
}

export interface TraceConfig {
  enable_argument_filter?: boolean;
  excluded_categories?: string[];
  histogram_names?: string[];
  included_categories?: string[];
  included_process_ids?: number[];
  memory_dump_config?: Record<string, unknown>;
  recording_mode?:
    | "record-until-full"
    | "record-continuously"
    | "record-as-much-as-possible"
    | "trace-to-console";
  trace_buffer_size_in_events?: number;
}

export interface TraceCategoriesAndOptions {
  categoryFilter: string;
  traceOptions: string;
}

export type MenuItemRole =
  | "undo"
  | "redo"
  | "cut"
  | "copy"
  | "paste"
  | "pasteAndMatchStyle"
  | "delete"
  | "selectAll"
  | "reload"
  | "forceReload"
  | "toggleDevTools"
  | "resetZoom"
  | "zoomIn"
  | "zoomOut"
  | "toggleSpellChecker"
  | "togglefullscreen"
  | "window"
  | "minimize"
  | "close"
  | "help"
  | "about"
  | "services"
  | "hide"
  | "hideOthers"
  | "unhide"
  | "quit"
  | "showSubstitutions"
  | "toggleSmartQuotes"
  | "toggleSmartDashes"
  | "toggleTextReplacement"
  | "startSpeaking"
  | "stopSpeaking"
  | "zoom"
  | "front"
  | "appMenu"
  | "fileMenu"
  | "editMenu"
  | "viewMenu"
  | "shareMenu"
  | "recentDocuments"
  | "toggleTabBar"
  | "selectNextTab"
  | "selectPreviousTab"
  | "showAllTabs"
  | "mergeAllWindows"
  | "clearRecentDocuments"
  | "moveTabToNewWindow"
  | "windowMenu";

export interface MenuItemConstructorOptions {
  role?: MenuItemRole;
  type?:
    | "normal"
    | "separator"
    | "submenu"
    | "checkbox"
    | "radio"
    | "header"
    | "palette";
  label?: string;
  sublabel?: string;
  toolTip?: string;
  accelerator?: string;
  icon?: string;
  enabled?: boolean;
  acceleratorWorksWhenHidden?: boolean;
  visible?: boolean;
  checked?: boolean;
  registerAccelerator?: boolean;
  sharingItem?: unknown;
  submenu?: MenuItemConstructorOptions[];
  id?: string;
  before?: string[];
  after?: string[];
  beforeGroupContaining?: string[];
  afterGroupContaining?: string[];
}

export interface LaunchItems {
  name: string;
  path: string;
  args: string[];
  scope: string;
  enabled: boolean;
}

export interface LoginItemSettings {
  openAtLogin: boolean;
  openAsHidden: boolean;
  wasOpenedAtLogin: boolean;
  wasOpenedAsHidden: boolean;
  restoreState: boolean;
  status: string;
  executableWillLaunchAtLogin: boolean;
  launchItems: LaunchItems[];
}

export interface Settings {
  openAtLogin?: boolean;
  openAsHidden?: boolean;
  type?:
    | "mainAppService"
    | "agentService"
    | "daemonService"
    | "loginItemService";
  serviceName?: string;
  path?: string;
  args?: string[];
  enabled?: boolean;
  name?: string;
}
