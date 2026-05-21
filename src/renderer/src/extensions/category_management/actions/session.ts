import * as reduxAct from "redux-act";

import safeCreateAction from "../../../actions/safeCreateAction";

export const showCategoriesDialog = safeCreateAction("SHOW_CATEGORIES_DIALOG", (show) => show);
