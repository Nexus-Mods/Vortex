import * as React from "react";
import { withTranslation } from "react-i18next";
import { PureComponentEx, util } from "vortex-api";

import * as api from "vortex-api";
const { Dashlet } = api as any;

const ARCTOOL_THREAD =
  "http://residentevilmodding.boards.net/thread/5774/arctool";
const DOWNLOAD_PAGE = "http://www.fluffyquack.com/tools";

class AttribDashlet extends PureComponentEx<{}, {}> {
  public render() {
    const { t } = this.props;
    return (
      <Dashlet
        title={t("Support for this game is made possible using ARCtool")}
        className="dashlet-arcsupport"
      >
        <div>
          {t("Shared with kind permission by {{author}}", {
            replace: { author: "FluffyQuack" },
          })}
        </div>
        <hr />
        <div>
          {t("Official Release Thread: ")}
          <a onClick={this.openThread}>{ARCTOOL_THREAD}</a>
        </div>
        <div>
          {t("Newest version is always available at: ")}
          <a onClick={this.openDLPage}>{DOWNLOAD_PAGE}</a>/ARCtool.rar
        </div>
      </Dashlet>
    );
  }

  private openThread = () => {
    (util as any).opn(ARCTOOL_THREAD);
  };

  private openDLPage = () => {
    (util as any).opn(DOWNLOAD_PAGE);
  };
}

export default withTranslation(["common", "arc-support"])(
  AttribDashlet as any,
) as React.ComponentClass<{}>;
