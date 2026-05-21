/**
 * Minimal @nexusmods/vortex-api mock for collections extension unit tests.
 *
 * Every entry below re-exports a real implementation directly from the renderer
 * source. The mock's only purpose is to break the dependency on the heavy
 * `@nexusmods/vortex-api` barrel (which transitively loads electron/native/UI
 * modules) so tests can call the genuine logic in a Node test environment.
 *
 * Please do not mock any logic here - use real implementations from the source files.
 */

import { generateCollectionSessionId } from "../../../src/renderer/src/extensions/collections_integration/util";
import { coerceToSemver } from "../../../src/renderer/src/extensions/mod_management/util/coerceToSemver";
import { findModByRef } from "../../../src/renderer/src/extensions/mod_management/util/findModByRef";
import { isFuzzyVersion } from "../../../src/renderer/src/extensions/mod_management/util/isFuzzyVersion";
import renderModName from "../../../src/renderer/src/extensions/mod_management/util/modName";
import { makeModReference } from "../../../src/renderer/src/extensions/mod_management/util/modReference";
import testModReference from "../../../src/renderer/src/extensions/mod_management/util/testModReference";
import { convertGameIdReverse } from "../../../src/renderer/src/extensions/nexus_integration/util/convertGameId";
import { log } from "../../../src/renderer/src/logging";
import { setSafe, merge } from "../../../src/renderer/src/util/storeHelper";

export { log };

export const util = {
  setSafe,
  merge,
  generateCollectionSessionId,
  renderModName,
  findModByRef,
  isFuzzyVersion,
  makeModReference,
  testModReference,
  coerceToSemver,
  convertGameIdReverse,
};

// `types` is type-only at the source level but production files still do
// `import { types, util } from "vortex-api"`, so we need a runtime binding.
export const types = {};
