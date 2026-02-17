import type { IExtensionContext } from "../../renderer/types/IExtensionContext";

function init(context: IExtensionContext) {
  // We chose not to integrate collections into the core API to simplify debugging
  // and to keep the core API lean. However, we still want to provide the collections
  // functionality through the core extension system to simplify development and maintenance
  // particularly when tracking collection installations.
  context.once(() => {});
  return true;
}

export default init;
