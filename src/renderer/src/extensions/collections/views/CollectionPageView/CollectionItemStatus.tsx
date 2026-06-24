import type { TFunction } from "i18next";
import * as React from "react";

import Icon from "../../../../controls/Icon";
import Spinner from "../../../../controls/Spinner";
import type { IDownload } from "../../../download_management/types/IDownload";
import type { ICollectionItemRow } from "../../installSession/itemRows";

interface ICollectionItemStatusProps {
  t: TFunction;
  mod: ICollectionItemRow;
  download?: IDownload;
}

class CollectionItemStatus extends React.Component<ICollectionItemStatusProps, {}> {
  public render(): JSX.Element {
    const { t, download, mod } = this.props;
    const recommended = mod.collectionRule.type === "recommends";

    // Download and install/extraction progress is not shown per-mod: a lightweight
    // indeterminate spinner (the same one the post-processing window uses) reads as
    // activity without the per-tick cost of a progress radial.
    const spinner = (titleKey: string) => (
      <div className="collection-status-progress">
        <Spinner className="collection-progress-radial" />

        <div className="progress-title">{t(titleKey)}</div>
      </div>
    );

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
        return spinner("Installing...");
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
        return spinner("Downloading...");
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
