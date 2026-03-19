import type { IExtensionApi } from "./IExtensionContext";
import type { IModifiers } from "./IModifiers";

/**
 * the context object passed along with all components
 *
 * @export
 * @interface IContext
 */
export interface IComponentContext {
  api: IExtensionApi;
  menuLayer: HTMLDivElement;
  getModifiers: () => IModifiers;
}
