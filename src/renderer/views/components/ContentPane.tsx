import React, { type FC } from "react";

import {
  gameSettingsPage,
  settingsPage,
  usePageRendering,
  useMainPages,
} from "../../hooks";
import { DNDContainer } from "../DNDContainer";

export const ModernContentPane: FC = () => {
  const mainPages = useMainPages();

  const { renderPage } = usePageRendering();

  return (
    <div className="grow overflow-auto rounded-lg bg-surface-low p-3">
      <DNDContainer
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          position: "relative",
        }}
      >
        {mainPages.map(renderPage)}

        {renderPage(settingsPage)}

        {renderPage(gameSettingsPage)}
      </DNDContainer>
    </div>
  );
};
