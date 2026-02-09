import React, { type FC } from "react";

import { usePagesContext } from "../../contexts";
import { usePageRendering } from "../../hooks";
import { DNDContainer } from "../DNDContainer";

export const ModernContentPane: FC = () => {
  const { mainPages } = usePagesContext();

  const { renderPage } = usePageRendering();

  return (
    <div className="mr-3 mb-3 grow overflow-hidden rounded-lg bg-surface-low p-3">
      <DNDContainer
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          position: "relative",
        }}
      >
        {mainPages.map(renderPage)}
      </DNDContainer>
    </div>
  );
};
