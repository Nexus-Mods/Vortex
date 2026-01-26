import IconBar from "../controls/IconBar";
import type { IActionDefinition } from "../../types/IActionDefinition";
import { MainContext } from "./MainWindow";

import * as React from "react";
import { useTranslation } from "react-i18next";

export interface IBaseProps {
  open: boolean;
  overlayRef: (ref: HTMLElement | null) => void;
}

export const MainOverlay: React.FC<IBaseProps> = ({ open, overlayRef }) => {
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

  const classes = React.useMemo(() => {
    const result = ["overlay"];
    if (open) {
      result.push("in");
    }
    return result;
  }, [open]);

  return (
    <div className={classes.join(" ")}>
      <div ref={overlayRef} />
      <div className="flex-fill" />
      <div className="global-overlay">
        <IconBar
          t={t}
          group="help-icons"
          staticElements={buttons}
          orientation="vertical"
        />
      </div>
    </div>
  );
};

export default MainOverlay;
