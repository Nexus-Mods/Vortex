import type { TFunction } from "i18next";
import * as React from "react";
import { types } from "vortex-api";

export interface ICollectionReleaseStatusProps {
  t: TFunction;
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
      collection.attributes?.collectionId &&
      collection.attributes?.editable
    ) {
      const revisionStatus = collection.attributes?.revisionStatus;
      const isPublished = revisionStatus === "published";
      return isPublished ? (
        <div className="collection-status published">{t("Published")}</div>
      ) : (
        <div className="collection-status draft">{t("Draft")}</div>
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
