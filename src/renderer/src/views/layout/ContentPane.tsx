import React, { type FC } from "react";

import FlexLayout from "../../controls/FlexLayout";
import { DNDContainer } from "../DNDContainer";

/**
 * Content pane component.
 * For Classic layout.
 */
export const ContentPane: FC = ({ children }) => {
  return (
    <FlexLayout.Flex fill={true} id="main-window-pane">
      <DNDContainer
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        {children}
      </DNDContainer>
    </FlexLayout.Flex>
  );
};
