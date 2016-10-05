import { IExtensionApi } from './IExtensionContext';

/**
 * the context object passed along with all components
 * 
 * @export
 * @interface IContext
 */
export interface IComponentContext {
  api: IExtensionApi;
}
