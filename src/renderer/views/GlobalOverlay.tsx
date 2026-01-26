import IconBar from "../controls/IconBar";
import type { IActionDefinition } from "../../types/IActionDefinition";
import { MainContext } from "./MainWindow";

import * as React from "react";
import { useTranslation } from "react-i18next";

// Looks like we're not using it?

export const GlobalOverlay: React.FC = () => {
  const { t } = useTranslation();
  const context = React.useContext(MainContext);

  const buttons = React.useMemo<IActionDefinition[]>(() => {
    const result: IActionDefinition[] = [];
    if (process.env.NODE_ENV === "development") {
      result.push({
        icon: "mods",
        title: "Developer",
        action: () => context.api.events.emit("show-modal", "developer"),
      });
    }
    return result;
  }, [context.api]);

  return (
    <div className="global-overlay">
      <IconBar
        t={t}
        group="help-icons"
        staticElements={buttons}
        orientation="vertical"
      />
    </div>
  );
};

export default GlobalOverlay;
