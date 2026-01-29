import * as React from "react";
import { withTranslation } from "react-i18next";
import { Dashlet, PureComponentEx, util } from "vortex-api";

const DOWNLOAD_PAGE = "https://github.com/BepInEx/BepInEx";

// TODO: pull this list from github directly rather than maintain this array manually.
const contributors = [
  "ghorsington",
  "ManlyMarco",
  "usagirei",
  "js6pak",
  "keelhauled",
  "notfood",
  "exdownloader",
  "Therzok",
  "xoxfaby",
  "TheLounger",
];

class BepInExAttribDashlet extends PureComponentEx<{}, {}> {
  public render() {
    const { t } = this.props;
    return (
      <Dashlet
        title={t(
          "Support for this game is made possible using the Bepis Injector Extensible tool (BepInEx)",
        )}
        className="dashlet-bepinex"
      >
        <div>
          {t(
            'Special thanks to {{author}} for developing this tool, and all its contributors: {{nl}}"{{contributors}}"',
            {
              replace: {
                author: "Bepis",
                nl: "\n",
                contributors: contributors.join(", "),
              },
            },
          )}
        </div>
        <div>
          {t("BepInEx lives here: ")}
          <a onClick={this.openPage}>{DOWNLOAD_PAGE}</a>
        </div>
      </Dashlet>
    );
  }

  private openPage = () => {
    (util as any).opn(DOWNLOAD_PAGE).catch((err) => null);
  };
}

export default withTranslation(["common", "bepinex-modtype"])(
  BepInExAttribDashlet as any,
) as React.ComponentClass<{}>;
