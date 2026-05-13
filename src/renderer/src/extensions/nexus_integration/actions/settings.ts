import * as reduxAct from "redux-act";

import safeCreateAction from "../../../actions/safeCreateAction";

/*
 * associate with nxm urls
 */
export const setAssociatedWithNXMURLs = safeCreateAction(
  "SET_ASSOCIATED_WITH_NXM_URLS",
  (assoc) => assoc,
);
