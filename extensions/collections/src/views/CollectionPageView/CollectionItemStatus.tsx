import { IModEx } from "../../types/IModEx";

import i18next from "i18next";
import * as React from "react";
import { Icon, RadialProgress, types } from "vortex-api";

interface ICollectionItemStatusProps {
  t: i18next.TFunction;
  mod: IModEx;
  download?: types.IDownload;
  notifications: types.INotification[];
  container: Element;
  installing: boolean;
}

const RadialProgressT: any = RadialProgress;

class CollectionItemStatus extends React.Component<
  ICollectionItemStatusProps,
  {}
> {
  public render(): JSX.Element {
    const { t, download, mod } = this.props;

    if (mod.collectionRule["ignored"] === true) {
      return (
        <div className="collection-status-ignored">
          <Icon name="toggle-disabled" />
          {t("Ignored")}
        </div>
      );
    }

    if (mod.state === "installed") {
      if (mod.enabled) {
        return (
          <div className="collection-status-enabled">
            <Icon name="toggle-enabled" />
            {t("Enabled")}
          </div>
        );
      } else {
        return (
          <div className="collection-status-disabled">
            <Icon name="toggle-disabled" />
            {t("Disabled")}
          </div>
        );
      }
    } else if (mod.state === "installing") {
      const progressBarData = {
        min: 0,
        max: 100,
        value: (mod.progress ?? 0) * 100,
        class: "collection-install-progress",
      };
      // install (or rather: extraction) process is unfortunately only stored in the notification
      return (
        <div className="collection-status-progress">
          <RadialProgressT
            className="collection-progress-radial"
            data={[progressBarData]}
            totalRadius={32}
          />
          <div className="progress-title">{t("Installing...")}</div>
        </div>
      );
    } else if (mod.state === "downloading") {
      if (download?.state === "paused") {
        return (
          <div className="collection-status-paused">
            <Icon name="pause" />
            {t("Download paused")}
          </div>
        );
      } else if (download?.state === "failed") {
        return (
          <div className="collection-status-failed">
            <Icon name="warning" />
            {t("Download failed")}
          </div>
        );
      }

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
          <div className="progress-title">{t("Downloading...")}</div>
        </div>
      );
    } else {
      if (mod.collectionRule.type === "recommends") {
        return (
          <div className="collection-status-notinstalled">
            <Icon name="install" /> {t("Not installed")}
          </div>
        );
      } else {
        if (mod.state === "downloaded") {
          return (
            <div className="collection-status-pending">
              <Icon name="install" />
              {t("Install pending")}
            </div>
          );
        } else {
          return (
            <div className="collection-status-pending">
              <Icon name="download" />
              {t("Download pending")}
            </div>
          );
        }
      }
    }
  }
}

export default CollectionItemStatus;
