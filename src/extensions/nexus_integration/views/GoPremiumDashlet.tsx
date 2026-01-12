import Dashlet from "../../../renderer/controls/Dashlet";
import { ComponentEx, translate } from "../../../renderer/controls/ComponentEx";
import opn from "../../../util/opn";

import { PREMIUM_PATH } from "../constants";

import * as React from "react";
import { Button } from "react-bootstrap";
import { WithTranslation } from "react-i18next";
import { Campaign, nexusModsURL, Section, Content } from "../../../util/util";
import FlexLayout from "../../../renderer/controls/FlexLayout";
import Image from "../../../renderer/controls/Image";

class GoPremiumDashlet extends ComponentEx<WithTranslation, {}> {
  public render(): JSX.Element {
    const { t } = this.props;

    const premiumPictogramPath = "assets/pictograms/premium-pictogram.svg";

    return (
      <Dashlet title="" className="dashlet-go-premium">
        <Image className="premium-pictogram" srcs={[premiumPictogramPath]} />
        <div className="dashlet-premium-title">
          Get fast downloads with{" "}
          <span className="text-highlight">premium</span>
        </div>
        <div className="dashlet-premium-body">
          <span className="text-highlight">Upgrade to unlock</span> uncapped
          download speeds,
          <span className="text-highlight">
            {" "}
            auto-install collections
          </span> and <span className="text-highlight">no ads</span>.
        </div>
        <button className="dashlet-premium-button" onClick={this.goBuyPremium}>
          <FlexLayout type="row" className="dashlet-premium-button-content">
            {t("Go Premium")}
            <div className="arrow-forward" />
          </FlexLayout>
        </button>
      </Dashlet>
    );
  }

  private goBuyPremium = () => {
    this.context.api.events.emit(
      "analytics-track-click-event",
      "Go Premium",
      "Dashlet",
    );
    opn(
      nexusModsURL(PREMIUM_PATH, {
        section: Section.Users,
        campaign: Campaign.BuyPremium,
        content: Content.DashboardDashletAd,
      }),
    ).catch((err) => undefined);
  };
}

export default translate(["common"])(GoPremiumDashlet);
