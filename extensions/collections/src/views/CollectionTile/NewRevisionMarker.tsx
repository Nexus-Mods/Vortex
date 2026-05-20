import { Icon, types } from "@nexusmods/vortex-api";
import * as React from "react";

interface INewRevisionMarkerProps {
  t: types.TFunction;
  collection: types.IMod;
  updating: boolean;
}

function NewRevisionMarker(props: INewRevisionMarkerProps) {
  const { t, collection, updating } = props;

  if (
    collection.attributes?.["newestVersion"] === undefined ||
    parseInt(collection.attributes?.["newestVersion"], 10) <=
      parseInt(collection.attributes?.["version"], 10)
  ) {
    return null;
  }

  return (
    <div className="collections-new-revision">
      <Icon name={updating ? "spinner_new" : "details"} />
      {t("Update")}
    </div>
  );
}

export default NewRevisionMarker;
