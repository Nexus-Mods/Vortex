# Types

## FileInformation

This is an object that contains all the meta information that the server
holds about a file.

* fileName (string) - physical file name as stored on disk without path and with
 extension. Example: 'SkyUI_5_1-3863-5-1.7z'
* fileSizeBytes (number) - size of the file in bytes.
* gameId (string) - unique identifier for the game this file can be used for. These ids
 should be kept the same across all servers and should be the same as used by game-support
 extensions used by Vortex
 Example: 'skyrim'
* logicalFileName (string, optional) - An abstract name that uniquely identifies all
 versions of the _same_ file.
 Assume you have a mod that replaces armors and it has different files for each armor
 type and different variants of each for different body types.
 You could have logical file names like "Leather Armor UNP", "Leather Armor Vanilla"
* fileVersion (string) - version string of the file. This can only be used for
 file references if it follows semantic versioning. Example: '5.1.0'
 To a degree non-semantic versions can be used as they are auto-converted, i.e.
 '5.1' -> '5.1.0', '5.05' -> '5.5.0'
* sourceURI (string) - An url where this file can be downloaded. If this is an
 http(s) link it should be a direct link, the manager will not follow 302 redirects
 or interpret webpages to allow for javascript/html redirections.
 For other protocols (i.e. nxm, magnet) support may be added to the mod manager,
 otherwise the link will be useless.
* details (dictionary) - a dictionary of further attributes of the file. all
 attributes herein are optional, as is their use inside the client.
* rules: (list of Rule objects) - a list of dependency rules for this mod.
 This is the actual meat of this protocol.

## Rule

A rule object declares a relation between the file that contains the rule
and any other file.

* type (RuleType) - The nature of the relation
* reference (Reference) - The referenced mod 

## RuleType

RuleType is a simple string identifier and has to be one of the following
- 'requires' - The file with the rule depends on the referenced one to be installed
 and active.
- 'conflicts' - The file with the rule must not be active at the same time as the
 referenced one. 
- 'provides' - The file with this rule provides the same functionality as the
 referenced file. This is similar to a conflict in that only one of the two files should
 be installed but here it's not because they are incompatible but because the other one
 becomes superfluous. This could also be used for a feature where the user
 gets to pick from different alternative implementations of the same feature.
- 'recommends' - The file with the rule should be installed together with the
 referenced one, but this is not a hard rule.
- 'before' - The file with this rule has to be loaded before the referenced one.
- 'after' - The file with the rule has to be loaded after the referenced one.

## Reference

A reference is an object that is similar to a subset of FileInformation that is used
exclusively to identify the file.

* fileMD5 (string) - The md5 hash of the file. Should usually be enough to identify a
 an exact file. It can not be used in version-range matches. There may still be multiple matches,
 i.e. due to hash collisions or because the same file has been uploaded multiple times
* fileSizeBytes (number) - size of the file in bytes. Used to avoid collisions when using a md5
 hash for matching
* gameId (string) - Identifies a game. Used to avoid collisions when using a md5 hash for matching
* logicalFileName (string) - Together with modId this identifies the "content" to
 to refence without specifying the version.
* fileExpression (string) - A regular expression to be matched against the physical file
 name. This can be used in place of logicalFileName if that doesn't exist. (For performance
 reasons this should always only be plan B)
* versionMatch (string) - A match expression against fileVersion. If used, the reference
 will always match the newest file for which this matcher is valid.
 This works only with semantic version numbers and the syntax can be looked up here:
 https://github.com/npm/node-semver#ranges 

# Protocol

A compliant server should support one of the following protocols.
It should document which protocol it uses and whether it syncs with other servers.
If it does, you should also explain
- which servers those are
- whether it caches results from those servers
- if it caches, how long it will hold cache results

## REST

### lookup

/byKey/:file_key
(no body)

look up a file by its _key_.
The _key_ is a combination of the file hash (required) and further
optional fields, separated by colons:
- file size in bytes
- game id
- mod id

The optional fields have to be specified in sequence and can't be left out.
This is necessary as otherwise efficient lookup wouldn't be possible.
Valid keys:
- 58e6baf1108091ad59681c20c65dd6d:::
- 58e6baf1108091ad59681c20c65dd6d:4711::
- 58e6baf1108091ad59681c20c65dd6d:4711:skyrim:
- 58e6baf1108091ad59681c20c65dd6d:4711:skyrim:12345
Invalid keys (will simply not return a result):
- 58e6baf1108091ad59681c20c65dd6d::skyrim:

### setting data

/describe
body: FileInformation

Add / Change the description of a file. The FileInformation object
in the body needs to contain all fields used for identification (fileMD5,
modId, fileName, fileSizeBytes, logicalFileName, fileVersion).
Other files are optional. If fields are left out, a merge happens so that
existing values - if availabel - are maintained.
If the file being described is _not_ in the database yet and not in a
backend server then leaving out fields may leave the entry useless.
