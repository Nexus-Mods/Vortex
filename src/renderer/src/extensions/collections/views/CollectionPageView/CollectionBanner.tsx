import type { TFunction } from "i18next";
import * as React from "react";
import { Button } from "react-bootstrap";

import { ComponentEx } from "../../../../controls/ComponentEx";
import FlexLayout from "../../../../controls/FlexLayout";
import Icon from "../../../../controls/Icon";
import Image from "../../../../controls/Image";
import { Pictogram } from "../../../../ui/components/pictogram/Pictogram";
import opn from "../../../../util/opn";
import { Campaign, Content, nexusModsURL, Section } from "../../../../util/util";
import { PREMIUM_PATH } from "../../constants";

export interface ICollectionBannerProps {
  totalSize: number;
  t: TFunction;
}

class CollectionBanner extends ComponentEx<ICollectionBannerProps, {}> {
  public render(): JSX.Element {
    const { t } = this.props;

    const electricBoltIconPath = "assets/icons/electric-bolt.svg";

    return (
      <div id="collection-premium-banner">
        <FlexLayout type="column">
          <FlexLayout.Fixed>
            <FlexLayout id="collection-premium-banner-header" type="row">
              <FlexLayout.Fixed>
                <Pictogram brand="premium" name="premium" size="2xs" />
              </FlexLayout.Fixed>

              <FlexLayout.Flex>
                <div className="collections-premium-banner-title">{t("Premium")}</div>
              </FlexLayout.Flex>
            </FlexLayout>
          </FlexLayout.Fixed>

          <FlexLayout.Flex>
            <div className="collections-premium-banner-body">
              {t("Auto-download collections at max speed")}
            </div>
          </FlexLayout.Flex>

          <FlexLayout.Fixed>
            <Button className="small" id="get-premium-button" onClick={this.goGetPremium}>
              <Image srcs={[electricBoltIconPath]} />

              {t("Unlock max download speeds")}
            </Button>
          </FlexLayout.Fixed>
        </FlexLayout>
      </div>
    );
  }

  private goGetPremium = () => {
    this.context.api.events.emit(
      "analytics-track-click-event",
      "Go Premium",
      "Collections Added Collection",
    );
    opn(
      nexusModsURL(PREMIUM_PATH, {
        section: Section.Users,
        campaign: Campaign.BuyPremium,
        content: Content.CollectionsDownloadAd,
      }),
    ).catch((err) => undefined);
  };
}

export default CollectionBanner;
