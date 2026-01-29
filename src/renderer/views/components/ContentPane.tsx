import React from "react";

import type { IMainPage } from "../../../types/IMainPage";

import { DNDContainer } from "../DNDContainer";
import { settingsPage, usePageRendering } from "../layout";

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
      </DNDContainer>
    </div>
  );
};
