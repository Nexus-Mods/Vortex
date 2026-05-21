import { Icon, types } from "@nexusmods/vortex-api";
import * as React from "react";

function Tag(props: { t: types.TFunction }) {
  const { t } = props;

  return (
    <div className="collections-you-curated-tag">
      <Icon name="completed" />
      {t("You curated this collection")}
    </div>
  );
}

export default Tag;
