import i18next from "i18next";
import * as React from "react";
import { types, util } from "vortex-api";

export interface ICollectionReleaseStatusProps {
  t: i18next.TFunction;
  collection: types.IMod;
  active: boolean;
  enabled: boolean;
  incomplete: boolean;
}

function CollectionReleaseStatus(props: ICollectionReleaseStatusProps) {
  const { t, active, collection, enabled, incomplete } = props;
  if (active) {
    if (incomplete) {
      return (
        <div className="collection-status incomplete">{t("Incomplete")}</div>
      );
    } else if (
      util.getSafe(collection.attributes, ["collectionId"], undefined) !==
        undefined &&
      util.getSafe(collection.attributes, ["editable"], false)
    ) {
      return (
        <div className="collection-status published">{t("Published")}</div>
      );
    } else if (enabled) {
      return <div className="collection-status enabled">{t("Enabled")}</div>;
    } else {
      return <div className="collection-status disabled">{t("Disabled")}</div>;
    }
  } else {
    return null;
  }
}

export default CollectionReleaseStatus;
