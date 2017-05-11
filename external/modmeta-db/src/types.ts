/**
 * reference to a mod file.
 *
 * This can be a reference to one exact file, using the md5 hash of that file or
 * to different versions of the same file.
 *
 * When referencing multiple versions of a file you need to specify the modId, the
 * version numbers to accept (see below) and which file to use.
 *
 * Usually mods on file repositories like nexus have a name including the version
 * number. To match files with a dynamic version number, you can use either a
 * fileExpression (which is a glob pattern) that should ideally match all versions of a file
 * (i.e. SkyUI_\d+_\d+-3863-\d+-\d+.7z] to match all versions of SkyUI on nexus)
 * or through a "logical" file name, which could be something like
 * "Skimpy Leather Armor UNP" (to differentiate it from the CBBE version under
 * the same modId).
 * logical file names need to be provided by the meta server so they may not
 * exist everywhere but they should be preferred over file expressions where
 * possible.
 *
 * versionMatch specifies which version to use. It can be
 * a) =[version number] for an exact version match which works independent of the
 * versioning scheme
 *
 * b) a number of other comparison operators. These work correctly only
 * if the referenced mod uses semantic versioning!
 *  >=[version number] matches any version newer than or equal to the one
 *                     mentioned.
 * In the same way you can use >, <, <=
 * You can combine multiple rules, like ">=1.2.1 <=1.3.6" to match the newest
 * file in the specified range.
 * "1.2.1 - 1.3.6" would have the same effect.
 *
 * Also you can use "1.x" to match the newest file with major version 1.
 * Or "~1.2.1" which would be the same as ">=1.2.1 <1.3.0".
 * Or "^1.2.1" which would be the same as ">=1.2.1 <2.0.0"
 *
 * You can find all the available rules at: https://github.com/npm/node-semver
 * (this is the library we use for version matching)
 *
 * Rationale: You may be wondering why you should go through the trouble of
 *   specifying mod ranges instead of just giving the newest version that has
 *   been verified to work. The problem is that different mods may have different
 *   compatibility ranges for the same dependency.
 *   Say you have two mods that both depend on SkyUI. One is compatible with
 *   version 3.3 - 5.0, some breakage made it incompatible with the newest version 5.1.
 *   The other mod is compatible with all versions >= 4.6.
 *   If both mods specify ranges we can install 5.0 and all dependencies are fulfilled.
 *
 *   If the second mod specifies only the newest version (5.1) as compatible, we have a
 *   conflict and one of the two mods has to be disabled. Or the user has to find out
 *   which version to use, override and thus rendering the complete dependency
 *   information useless.
 *
 * All this works best if mods adhere to the semantic versioning rules, which means:
 * a) increment the major version whenever you break the "API". API meaning any
 *    interface (variables, ids, functions, ...) that other mods may use to interact with
 *    yours
 * b) increment the minor version whenever you add features without breaking the api
 * c) increment the patch level on bugfix-only releases
 * This way dependending mods can specify the dependency with "^<tested version>" and
 * be reasonably safe that every newer minor/patch-version should work as well because
 * without an api change it can't break.
 *
 * @export
 * @interface IReference
 */
export interface IReference {
  fileMD5?: string;
  versionMatch?: string;
  logicalFileName?: string;
  fileExpression?: string;
}

export type RuleType = 'before' | 'after' | 'requires' | 'conflicts' | 'recommends' | 'provides';

/**
 * a rule defining a relation to another mod.
 * The mod can either be specified with a file hash (which will always match
 * the exact same file at the same version) or through an IReference, which
 * can match a file with more complex rules, allowing, for example, to get
 * the newest compatible version of a file.
 *
 * @export
 * @interface IRule
 */
export interface IRule {
  type: RuleType;
  reference: IReference;
  comment?: string;
}

/**
 * info about a single file
 *
 * @export
 * @interface IModInfo
 */
export interface IModInfo {
  fileName: string;
  fileSizeBytes: number;
  gameId: string;
  logicalFileName?: string;
  fileVersion: string;
  fileMD5: string;
  sourceURI: any;
  rules?: IRule[];
  expires?: number;
  details?: {
    homepage?: string;
    category?: string;
    description?: string;
    author?: string;
  };
}

/**
 * result of a lookup call.
 * There may be multiple items returned if the
 * lookup wasn't precise enough
 *
 * @export
 * @interface ILookupResult
 */
export interface ILookupResult {
  key: string;
  value: IModInfo;
}

export interface IIndexResult {
  key: string;
  value: string;
}

export interface IHashResult {
  md5sum: string;
  numBytes: number;
}
