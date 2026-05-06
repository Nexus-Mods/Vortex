import * as reduxAct from "redux-act";

import safeCreateAction from "../../../actions/safeCreateAction";

export const setDeploymentNecessary = safeCreateAction(
  "SET_NEED_DEPLOYMENT",
  (gameId: string, required: boolean) => ({ gameId, required }),
);
