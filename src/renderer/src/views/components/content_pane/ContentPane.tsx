import React, { type FC } from "react";
import { useSelector } from "react-redux";

import { usePagesContext } from "@/contexts";
import { showsGameArt } from "@/extensions/settings_interface/selectors";
import { usePageRendering } from "@/hooks";
import { joinClasses } from "@/ui/utils/joinClasses";

import { DNDContainer } from "../../DNDContainer";

export const ModernContentPane: FC<React.PropsWithChildren<unknown>> = () => {
  const { mainPages } = usePagesContext();

  const { mainPage, renderPage } = usePageRendering();
  const showGameArt = useSelector(showsGameArt);
  const isTranslucent =
    showGameArt && !!mainPages.find((page) => page.id === mainPage)?.isTranslucent;

  return (
    <div
      className={joinClasses([
        "mr-3 mb-3 grow overflow-hidden rounded-lg",
        isTranslucent ? "bg-surface-translucent-low" : "bg-surface-low",
      ])}
      data-testid="content-pane"
    >
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
