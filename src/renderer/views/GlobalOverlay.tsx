import IconBar from "../controls/IconBar";
import type { IActionDefinition } from "../../types/IActionDefinition";
import { ComponentEx } from "../controls/ComponentEx";

import type { TFunction } from "i18next";

export interface IBaseProps {
  t: TFunction;
}

type IProps = IBaseProps;

class GlobalOverlay extends ComponentEx<IProps, object> {
  private buttons: IActionDefinition[];
  constructor(props: IProps) {
    super(props);

    this.buttons = [];
    if (process.env.NODE_ENV === "development") {
      this.buttons.push({
        icon: "mods",
        title: "Developer",
        action: () => this.context.api.events.emit("show-modal", "developer"),
      });
    }
  }

  public render(): JSX.Element {
    const { t } = this.props;
    return (
      <div className="global-overlay">
        <IconBar
          t={t}
          group="help-icons"
          staticElements={this.buttons}
          orientation="vertical"
        />
      </div>
    );
  }
}

export default GlobalOverlay;
