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

export { getContainer } from "./runtime-container";

export type { URI, PID, MessageId, SemVer, AdaptorName } from "./types/branded";
export { uri, pid, messageId, semVer, adaptorName } from "./types/branded";
