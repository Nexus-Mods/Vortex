import safeCreateAction from "../../renderer/actions/safeCreateAction";

import * as reduxAct from "redux-act";

export const enableUserSymlinks = safeCreateAction(
  "ENABLE_USER_SYMLINKS",
  (enabled: boolean) => enabled,
);
