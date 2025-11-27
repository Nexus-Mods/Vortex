export const APP_MANIFEST = 'appxmanifest.xml';
export const STORE_ID: string = 'xbox';
export const STORE_NAME: string = 'Xbox';
// unwritable game directories => many games aren't actually moddable
export const STORE_PRIORITY: number = 105;
export const MICROSOFT_PUBLISHER_ID: string = '8wekyb3d8bbwe';

export const XBOXAPP_NAMES = ['microsoft.xboxapp', 'microsoft.gamingapp'];



// List of package naming patterns which are safe to ignore
//  when browsing the package repository.
export const IGNORABLE: string[] = [
  'microsoft.accounts', 'microsoft.aad', 'microsoft.advertising', 'microsoft.bing', 'microsoft.desktop',
  'microsoft.directx', 'microsoft.gethelp', 'microsoft.getstarted', 'microsoft.hefi', 'microsoft.lockapp',
  'microsoft.microsoft', 'microsoft.net', 'microsoft.office', 'microsoft.oneconnect', 'microsoft.services',
  'microsoft.ui', 'microsoft.vclibs', 'microsoft.windows', 'microsoft.xbox', 'microsoft.zune', 'nvidiacorp',
  'realtek', 'samsung', 'synapticsincorporated', 'windows', 'dellinc', 'microsoft.people', 'ad2f1837',
];

// Generally contains all game specific information.
//  Please note: Package display name might not be resolved correctly.
export const REPOSITORY_PATH: string = 'Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppModel\\Repository\\Packages';

// A secondary repository path which can be used to ascertain the app's execution name.
export const REPOSITORY_PATH2: string = 'Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppModel\\PackageRepository\\Packages';

// Path to the registry location containing the mutable path locations.
export const MUTABLE_LOCATION_PATH: string = 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AppModel\\StateRepository\\Cache\\Package\\Data';

// Registry key path pattern pointing to a package's resources.
//  Xbox app will always have an entry for a package inside C:\Program Files\WindowsApps
//  even when installed to a different partition (Windows creates symlinks).
export const RESOURCES_PATH: string = 'Local Settings\\MrtCache\\C:%5CProgram Files%5CWindowsApps%5C{{PACKAGE_ID}}%5Cresources.pri';