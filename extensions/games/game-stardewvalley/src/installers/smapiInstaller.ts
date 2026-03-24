/**
 * Backward-compatible shim for historical imports.
 *
 * SMAPI installer logic now lives in `installers/smapi/`.
 */
export {
  installSMAPI,
  isSMAPIModType,
  linuxSMAPIPlatform,
  macosSMAPIPlatform,
  resolveSMAPIPlatform,
  SMAPI_EXE,
  testSMAPI,
  windowsSMAPIPlatform,
} from "./smapi";
export type { ISMAPIPlatformVariant } from "./smapi";
