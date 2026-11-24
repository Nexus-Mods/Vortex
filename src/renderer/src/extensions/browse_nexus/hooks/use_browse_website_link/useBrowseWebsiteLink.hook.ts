import { createContext, useCallback, useContext } from "react";

import { withVortexSource } from "@/extensions/nexus_integration/util/nexus_urls/nexusUrls";

/** The shown mod's position in Browse's list, counting from 1, for the website links it opens. */
export const ShownModPositionContext = createContext<number | undefined>(undefined);

/**
 * Makes a website link say Browse sent the user, and where the shown mod is in the list, so the
 * site can attribute the download it leads to.
 */
export const useBrowseWebsiteLink = () => {
  const position = useContext(ShownModPositionContext);

  return useCallback(
    (url: string) => withVortexSource({ url, feature: "browse", position }),
    [position],
  );
};
