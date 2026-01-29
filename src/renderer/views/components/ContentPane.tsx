import React from "react";

import type { IMainPage } from "../../../types/IMainPage";

import { gameSettingsPage, settingsPage, usePageRendering } from "../../utils";
import { DNDContainer } from "../DNDContainer";

export interface IModernContentPaneProps {
  objects: IMainPage[];
}

export const ModernContentPane = ({
  objects,
}: IModernContentPaneProps): JSX.Element => {
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
        {objects.map(renderPage)}

        {renderPage(settingsPage)}

        {renderPage(gameSettingsPage)}
      </DNDContainer>
    </div>
  );
};
