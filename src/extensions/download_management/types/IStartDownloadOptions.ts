export interface IStartDownloadOptions {
  // whether the download may be auto-installed if the user has that set up for mods (default: true)
  // if set to 'force', the download will be installed independent of the user config
  allowInstall?: boolean | 'force';
  // whether the url should be opened in the embedded browser if it's html (default: true)
  allowOpenHTML?: boolean;
}