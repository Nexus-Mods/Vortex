import type { IState } from "@/types/IState";

import {
  FOMOD_OPTIONS_CHECK_ID,
  type IFomodOptionIssue,
  type IFomodOptionsCheckMetadata,
} from "../../checks/fomodOptionsCheck";
import { DetailView } from "../../components/fomod_option/DetailView";
import { ListingRow } from "../../components/fomod_option/ListingRow";
import { healthCheckResult } from "../../selectors";
import type { IHealthCheckContent } from "./types";

/** One listing entry per mod, not per option: the fix is per mod. */
const issues = (state: IState): IFomodOptionIssue[] =>
  healthCheckResult<IFomodOptionsCheckMetadata>(state, FOMOD_OPTIONS_CHECK_ID)?.metadata?.issues ??
  [];

export const fomodOptionsContent: IHealthCheckContent = {
  selectEntries: (state) =>
    issues(state).map((issue) => ({
      id: issue.modId,
      checkId: FOMOD_OPTIONS_CHECK_ID,
      severity: "suggestion",
      resolutionType: "reinstall",
      data: issue,
    })),
  ListingRow,
  DetailView,
};
