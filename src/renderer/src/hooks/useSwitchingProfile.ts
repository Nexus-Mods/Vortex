import { useSelector } from "react-redux";

import {
  activeProfileId as activeProfileIdSelector,
  nextProfileId as nextProfileIdSelector,
} from "../util/selectors";
import { truthy } from "../util/util";

export const useSwitchingProfile = () => {
  const activeProfileId = useSelector(activeProfileIdSelector);
  const nextProfileId = useSelector(nextProfileIdSelector);

  return activeProfileId !== nextProfileId && truthy(nextProfileId);
};
