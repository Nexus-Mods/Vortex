import i18next from "i18next";
import * as React from "react";
import { Button } from "react-bootstrap";
import { ComponentEx, FlexLayout, Icon, util, Image } from "vortex-api";
import { PREMIUM_PATH } from "../../constants";

export interface ICollectionBannerProps {
  totalSize: number;
  t: i18next.TFunction;
}

class CollectionBanner extends ComponentEx<ICollectionBannerProps, {}> {
  public render(): JSX.Element {
    const { t } = this.props;

    const electricBoltIconPath = "assets/icons/electric-bolt.svg";
    const premiumPictogramPath = "assets/pictograms/premium-pictogram.svg";

    return (
      <div id="collection-premium-banner">
        <FlexLayout type="column">
          <FlexLayout.Fixed>
            <FlexLayout type="row" id="collection-premium-banner-header">
              <FlexLayout.Fixed>
                <Image
                  className="premium-pictogram"
                  srcs={[premiumPictogramPath]}
                />
              </FlexLayout.Fixed>
              <FlexLayout.Flex>
                <div className="collections-premium-banner-title">
                  {t("Premium")}
                </div>
              </FlexLayout.Flex>
            </FlexLayout>
          </FlexLayout.Fixed>
          <FlexLayout.Flex>
            <div className="collections-premium-banner-body">
              {t("Auto-download collections at max speed")}
            </div>
          </FlexLayout.Flex>
          <FlexLayout.Fixed>
            <Button
              id="get-premium-button"
              className="small"
              onClick={this.goGetPremium}
            >
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
    util
      .opn(
        util.nexusModsURL(PREMIUM_PATH, {
          section: util.Section.Users,
          campaign: util.Campaign.BuyPremium,
          content: util.Content.CollectionsDownloadAd,
        }),
      )
      .catch((err) => undefined);
  };
}

export default CollectionBanner;
