import { useSelector } from "react-redux";

import type { IState } from "../../types/IState";

import { truthy } from "../../util/util";

export const useSwitchingProfile = () => {
  const activeProfileId = useSelector(
    (state: IState) => state.settings.profiles.activeProfileId,
  );
  const nextProfileId = useSelector(
    (state: IState) => state.settings.profiles.nextProfileId,
  );

  return activeProfileId !== nextProfileId && truthy(nextProfileId);
};
