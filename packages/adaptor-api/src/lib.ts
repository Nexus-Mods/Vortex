export { provides, getProvidedUri } from "./builder";

export type {
  IMessage,
  IMessageHandler,
  IServiceProxy,
  IAdaptorRuntime,
  IServiceResolver,
  IHandlerRegistry,
  IAdaptorManifest,
  ServiceRegistry,
  ServiceAliases,
  ServiceFor,
  IMethodMessage,
} from "./interfaces";

export {
  createContainer,
  activateContainer,
  deactivateContainer,
  getContainer,
} from "./runtime-container";

export type { URI, PID, MessageId, SemVer, AdaptorName } from "./types/branded";
export { uri, pid, messageId, semver, adaptorName } from "./types/branded";
