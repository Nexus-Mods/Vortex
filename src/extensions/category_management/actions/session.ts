import safeCreateAction from "../../../renderer/actions/safeCreateAction";

import * as reduxAct from "redux-act";

export const showCategoriesDialog = safeCreateAction(
  "SHOW_CATEGORIES_DIALOG",
  (show) => show,
);
