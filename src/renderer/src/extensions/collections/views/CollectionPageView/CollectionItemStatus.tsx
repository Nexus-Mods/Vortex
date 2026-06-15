import type { TFunction } from "i18next";
import * as React from "react";

import Icon from "../../../../controls/Icon";
import RadialProgress from "../../../../controls/RadialProgress";
import type { IDownload } from "../../../download_management/types/IDownload";
import type { ICollectionItemRow } from "../../installSession/itemRows";

interface ICollectionItemStatusProps {
  t: TFunction;
  mod: ICollectionItemRow;
  download?: IDownload;
}

const RadialProgressT: any = RadialProgress;

class CollectionItemStatus extends React.Component<ICollectionItemStatusProps, {}> {
  public render(): JSX.Element {
    const { t, download, mod } = this.props;
    const recommended = mod.collectionRule.type === "recommends";

    const radial = (titleKey: string) => {
      const progressBarData = {
        min: 0,
        max: 100,
        value: (mod.progress ?? 0) * 100,
        class: "collection-install-progress",
      };
      return (
        <div className="collection-status-progress">
          <RadialProgressT
            className="collection-progress-radial"
            data={[progressBarData]}
            totalRadius={32}
          />

          <div className="progress-title">{t(titleKey)}</div>
        </div>
      );
    };

    switch (mod.status) {
      case "ignored":
        return (
          <div className="collection-status-ignored">
            <Icon name="toggle-disabled" />

            {t("Ignored")}
          </div>
        );
      case "installed":
        return mod.enabled ? (
          <div className="collection-status-enabled">
            <Icon name="toggle-enabled" />

            {t("Enabled")}
          </div>
        ) : (
          <div className="collection-status-disabled">
            <Icon name="toggle-disabled" />

            {t("Disabled")}
          </div>
        );
      case "installing":
        // install/extraction progress is not tracked per-mod yet, so the radial is
        // indeterminate (0) for now
        return radial("Installing...");
      case "downloading":
        if (download?.state === "paused") {
          return (
            <div className="collection-status-paused">
              <Icon name="pause" />

              {t("Download paused")}
            </div>
          );
        }
        if (download?.state === "failed") {
          return (
            <div className="collection-status-failed">
              <Icon name="warning" />

              {t("Download failed")}
            </div>
          );
        }
        return radial("Downloading...");
      case "failed":
        return (
          <div className="collection-status-failed">
            <Icon name="warning" />

            {t("Install failed")}
          </div>
        );
      case "downloaded":
        return recommended ? (
          <div className="collection-status-notinstalled">
            <Icon name="install" /> {t("Not installed")}
          </div>
        ) : (
          <div className="collection-status-pending">
            <Icon name="install" />

            {t("Install pending")}
          </div>
        );
      default:
        // pending / optional
        return recommended ? (
          <div className="collection-status-notinstalled">
            <Icon name="install" /> {t("Not installed")}
          </div>
        ) : (
          <div className="collection-status-pending">
            <Icon name="download" />

            {t("Download pending")}
          </div>
        );
    }
  }
}

export default CollectionItemStatus;
