import React, { type FC } from "react";

import { usePagesContext } from "@/contexts";
import { usePageRendering } from "@/hooks";
import { joinClasses } from "@/ui/utils/joinClasses";

import { DNDContainer } from "../DNDContainer";
import { useGameArt } from "./game_art/GameArt.context";

export const ModernContentPane: FC<React.PropsWithChildren<unknown>> = () => {
  const { mainPages } = usePagesContext();

  const { mainPage, renderPage } = usePageRendering();
  const { isEnabled: showsGameArt } = useGameArt();
  const isTranslucent =
    showsGameArt && !!mainPages.find((page) => page.id === mainPage)?.isTranslucent;

  return (
    <div
      className={joinClasses([
        "mr-3 mb-3 grow overflow-hidden rounded-lg",
        isTranslucent ? "bg-surface-translucent-low" : "bg-surface-low",
      ])}
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
