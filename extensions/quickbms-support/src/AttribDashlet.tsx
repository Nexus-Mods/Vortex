import * as React from "react";
import { withTranslation } from "react-i18next";
import { PureComponentEx, util } from "vortex-api";

const DOWNLOAD_PAGE = "https://aluigi.altervista.org/quickbms.htm";

import * as api from "vortex-api";
const { Dashlet } = api as any;

class QBMSAttribDashlet extends PureComponentEx<{}, {}> {
  public render() {
    const { t } = this.props;
    return (
      <Dashlet
        title={t("Support for this game is made possible using QuickBMS")}
        className="dashlet-quickbms"
      >
        <div>
          {t("Special thanks to {{author}} for developing this tool", {
            replace: { author: "Luigi Auriemma" },
          })}
        </div>
        <div>
          {t("You can find the QBMS home page: ")}
          <a onClick={this.openQBMSPage}>{DOWNLOAD_PAGE}</a>
        </div>
      </Dashlet>
    );
  }

  private openQBMSPage = () => {
    (util as any).opn(DOWNLOAD_PAGE).catch((err) => null);
  };
}

export default withTranslation(["common", "qbms-support"])(
  QBMSAttribDashlet as any,
) as React.ComponentClass<{}>;
