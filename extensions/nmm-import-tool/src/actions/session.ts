import { createAction } from "redux-act";

import type { ImportStep } from "../types/state";

export const setImportStep = createAction<ImportStep | undefined, {}>("SET_NMM_IMPORT_STEP");

export const setMods = createAction("SET_MODS");

export const selectImportFolder = createAction<boolean, {}>("SELECT_IMPORT_FOLDER");
