import * as React from "react";
import { withTranslation } from "react-i18next";
import { Dashlet, PureComponentEx, util } from "vortex-api";

const DOWNLOAD_PAGE = "https://github.com/newman55/unity-mod-manager";

class UMMAttribDashlet extends PureComponentEx<{}, {}> {
  public render() {
    const { t } = this.props;
    return (
      <Dashlet
        title={t(
          "Support for this game is made possible using the Unity Mod Manager tool (UMM)",
        )}
        className="dashlet-umm"
      >
        <div>
          {t(
            "Special thanks to {{author}} and all other UMM contributors for developing this tool",
            { replace: { author: "newman55", nl: "\n" } },
          )}
        </div>
        <div>
          {t("UMM lives here: ")}
          <a onClick={this.openPage}>{DOWNLOAD_PAGE}</a>
        </div>
      </Dashlet>
    );
  }

  private openPage = () => {
    (util as any).opn(DOWNLOAD_PAGE).catch((err) => null);
  };
}

export default withTranslation(["common", "umm-modtype"])(
  UMMAttribDashlet as any,
) as React.ComponentClass<{}>;
