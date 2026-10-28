import { useSelector } from "react-redux";

import { userInfo as selectUserInfo } from "@/extensions/nexus_integration/selectors";

/**
 * Whether adult content is to be blurred, by the logged-in user's `adultBlurImages` preference;
 * it is when no one is logged in or the preference is unknown, so adult content is never shown
 * to a user who hasn't opted into seeing it. Never for content that isn't adult.
 */
export const useIsAdultBlurred = (isAdult: boolean) => {
  const blurAdultContent = useSelector(selectUserInfo)?.adultBlurImages ?? true;

  return isAdult && blurAdultContent;
};
