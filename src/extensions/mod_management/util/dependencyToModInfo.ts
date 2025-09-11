import { IModInfo } from 'modmeta-db';
import { IDependency } from '../types/IDependency';
import { IMod } from '../types/IMod';

/**
 * Converts a dependency object to an IModInfo object
 * @param dependency The dependency object to convert
 * @param gameId The game ID for the mod info
 * @returns A properly formatted IModInfo object
 */
export function dependencyToModInfo(dependency: IDependency, gameId: string): IModInfo {
  // Extract mod info from lookup results if available
  const primaryLookupResult = dependency.lookupResults?.[0]?.value;
  
  // Get mod reference info
  const reference = dependency.reference;
  
  // Get mod info if the dependency is already installed
  const mod: IMod | undefined = dependency.mod;
  
  // Determine file name - prioritize from various sources
  const fileName = primaryLookupResult?.fileName 
    || reference?.logicalFileName 
    || mod?.attributes?.logicalFileName
    || mod?.attributes?.fileName
    || reference?.description
    || 'Unknown';

  // Determine file size - try to get from various sources
  const fileSizeBytes = primaryLookupResult?.fileSizeBytes 
    || mod?.attributes?.fileSizeBytes
    || mod?.attributes?.size
    || 0;

  // Build the IModInfo object
  const modInfo: IModInfo = {
    fileName,
    fileSizeBytes,
    gameId,
    
    // Required fields with fallbacks
    fileVersion: reference?.versionMatch || primaryLookupResult?.fileVersion || mod?.attributes?.version || '1.0',
    fileMD5: reference?.fileMD5 || mod?.attributes?.fileMD5 || '',
    sourceURI: primaryLookupResult?.sourceURI || '',
    
    // Optional fields
    ...(primaryLookupResult?.logicalFileName && { logicalFileName: primaryLookupResult.logicalFileName }),
    ...(primaryLookupResult?.source && { source: primaryLookupResult.source }),
    ...(primaryLookupResult?.domainName && { domainName: primaryLookupResult.domainName }),
    ...(primaryLookupResult?.expires && { expires: primaryLookupResult.expires }),
    ...(primaryLookupResult?.archived !== undefined && { archived: primaryLookupResult.archived }),
    ...(primaryLookupResult?.status && { status: primaryLookupResult.status }),
    
    // Details object - merge information from various sources
    ...(primaryLookupResult?.details || reference?.repo || mod?.attributes && {
      details: {
        ...(primaryLookupResult?.details || {}),
        ...(reference?.repo?.modId && { modId: reference.repo.modId }),
        ...(reference?.repo?.fileId && { fileId: reference.repo.fileId }),
        ...(mod?.attributes?.author && { author: mod.attributes.author }),
        ...(mod?.attributes?.description && { description: mod.attributes.description }),
        ...(mod?.attributes?.homepage && { homepage: mod.attributes.homepage }),
        ...(mod?.attributes?.category && { category: mod.attributes.category }),
      }
    }),
    
    // Rules from lookup results or dependency extra data
    ...(primaryLookupResult?.rules && { rules: primaryLookupResult.rules }),
    ...(dependency.extra?.rules && { rules: dependency.extra.rules }),
  };

  // Remove undefined values to keep the object clean
  const cleanModInfo = Object.fromEntries(
    Object.entries(modInfo).filter(([_, value]) => value !== undefined)
  ) as IModInfo;

  return cleanModInfo;
}

/**
 * Converts multiple dependencies to IModInfo objects
 * @param dependencies Array of dependency objects to convert
 * @param gameId The game ID for the mod infos
 * @returns Array of properly formatted IModInfo objects
 */
export function dependenciesToModInfos(dependencies: IDependency[], gameId: string): IModInfo[] {
  return dependencies
    .filter(dep => dep && !('error' in dep)) // Filter out dependency errors
    .map(dep => dependencyToModInfo(dep, gameId));
}

/**
 * Extracts the best available mod name from a dependency
 * @param dependency The dependency object
 * @returns The most appropriate display name for the mod
 */
export function getDependencyDisplayName(dependency: IDependency): string {
  const primaryLookupResult = dependency.lookupResults?.[0]?.value;
  const reference = dependency.reference;
  const mod = dependency.mod;
  
  return primaryLookupResult?.details?.modId
    || mod?.attributes?.customFileName
    || mod?.attributes?.name
    || reference?.description
    || reference?.logicalFileName
    || primaryLookupResult?.fileName
    || 'Unknown Mod';
}

/**
 * Checks if a dependency has sufficient information to create a valid ModInfo
 * @param dependency The dependency object to validate
 * @returns True if the dependency has sufficient information
 */
export function isDependencyComplete(dependency: IDependency): boolean {
  if (!dependency || 'error' in dependency) {
    return false;
  }
  
  const hasFileName = !!(
    dependency.lookupResults?.[0]?.value?.fileName ||
    dependency.reference?.logicalFileName ||
    dependency.mod?.attributes?.logicalFileName ||
    dependency.mod?.attributes?.fileName ||
    dependency.reference?.description
  );
  
  const hasIdentification = !!(
    dependency.reference?.fileMD5 ||
    dependency.reference?.repo?.modId ||
    dependency.reference?.repo?.fileId ||
    dependency.mod?.id
  );
  
  return hasFileName && hasIdentification;
}

/**
 * Extracts and constructs an IModInfo object from a complex nested object structure
 * @param obj The complex object containing mod information (could have choices, patches, download.modInfo, etc.)
 * @param gameId The game ID for the mod info
 * @returns A properly formatted IModInfo object extracted from the nested data
 */
export function extractModInfoFromObject(obj: any, gameId: string): IModInfo {
  // Helper function to safely get nested values
  const getValue = (path: string, fallback: any = undefined) => {
    return path.split('.').reduce((current, key) => current?.[key], obj) ?? fallback;
  };

  // Helper function to get the first available value from multiple paths
  const getFirstValue = (...paths: string[]) => {
    for (const path of paths) {
      const value = getValue(path);
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
    return undefined;
  };

  // Extract core required fields with multiple fallback paths
  const fileName = getFirstValue(
    'download.modInfo.fileName',
    'modInfo.fileName', 
    'fileName',
    'reference.logicalFileName',
  ) || 'Unknown';

  const fileSizeBytes = getFirstValue(
    'download.modInfo.fileSizeBytes',
    'modInfo.fileSizeBytes',
    'fileSizeBytes',
    'reference.fileSizeBytes'
  ) || 0;

  const fileVersion = getFirstValue(
    'download.modInfo.fileVersion',
    'modInfo.fileVersion',
    'fileVersion',
    'reference.versionMatch',
    'version'
  ) || '1.0';

  const fileMD5 = getFirstValue(
    'download.modInfo.fileMD5',
    'modInfo.fileMD5',
    'fileMD5',
    'reference.fileMD5',
    'md5'
  ) || '';

  const sourceURI = getFirstValue(
    'download.modInfo.sourceURI',
    'modInfo.sourceURI',
    'sourceURI',
    'download.url',
    'url'
  ) || '';

  // Extract optional fields
  const logicalFileName = getFirstValue(
    'download.modInfo.logicalFileName',
    'modInfo.logicalFileName',
    'logicalFileName',
    'reference.logicalFileName'
  );

  const source = getFirstValue(
    'download.modInfo.source',
    'modInfo.source',
    'source',
    'reference.source'
  );

  const domainName = getFirstValue(
    'download.modInfo.domainName',
    'modInfo.domainName',
    'domainName',
    'reference.domainName'
  );

  const expires = getFirstValue(
    'download.modInfo.expires',
    'modInfo.expires',
    'expires',
  );

  const archived = getFirstValue(
    'download.modInfo.archived',
    'modInfo.archived',
    'archived',
  );

  const status = getFirstValue(
    'download.modInfo.status',
    'modInfo.status',
    'status',
  );

  // Extract rules from various possible locations
  const rules = getFirstValue(
    'download.modInfo.rules',
    'modInfo.rules',
    'rules',
    'reference.rules'
  );

  // Extract details object with nested information
  const details = {
    ...(getFirstValue(
      'download.modInfo.details',
      'modInfo.details',
      'details',
    ) || {}),
    
    // Add individual detail fields if available
    ...(getFirstValue('homepage', 'download.modInfo.homepage', 'modInfo.homepage') && {
      homepage: getFirstValue('homepage', 'download.modInfo.homepage', 'modInfo.homepage')
    }),
    ...(getFirstValue('category', 'download.modInfo.category', 'modInfo.category') && {
      category: getFirstValue('category', 'download.modInfo.category', 'modInfo.category')
    }),
    ...(getFirstValue('description', 'download.modInfo.description', 'modInfo.description') && {
      description: getFirstValue('description', 'download.modInfo.description', 'modInfo.description')
    }),
    ...(getFirstValue('author', 'download.modInfo.author', 'modInfo.author') && {
      author: getFirstValue('author', 'download.modInfo.author', 'modInfo.author')
    }),
    ...(getFirstValue('modId', 'download.modInfo.modId', 'modInfo.modId') && {
      modId: getFirstValue('modId', 'download.modInfo.modId', 'modInfo.modId')
    }),
    ...(getFirstValue('fileId', 'download.modInfo.fileId', 'modInfo.fileId') && {
      fileId: getFirstValue('fileId', 'download.modInfo.fileId', 'modInfo.fileId')
    }),
  };

  // Build the complete IModInfo object
  const modInfo: IModInfo = {
    fileName,
    fileSizeBytes,
    gameId,
    fileVersion,
    fileMD5,
    sourceURI,
    
    // Add optional fields only if they have values
    ...(logicalFileName && { logicalFileName }),
    ...(source && { source }),
    ...(domainName && { domainName }),
    ...(expires && { expires }),
    ...(archived !== undefined && { archived }),
    ...(status && { status }),
    ...(rules && { rules }),
    ...(Object.keys(details).length > 0 && { details }),
  };

  // Remove any undefined values to keep the object clean
  const cleanModInfo = Object.fromEntries(
    Object.entries(modInfo).filter(([_, value]) => value !== undefined && value !== null && value !== '')
  ) as IModInfo;

  return cleanModInfo;
}
