import * as React from "react";
import FlexLayout from "../../controls/FlexLayout";
import DNDContainer from "../DNDContainer";

export interface IContentPaneProps {
  children: React.ReactNode;
}

const ContentPane: React.FC<IContentPaneProps> = ({ children }) => (
  <FlexLayout.Flex fill id="main-window-pane">
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

export default ContentPane;
