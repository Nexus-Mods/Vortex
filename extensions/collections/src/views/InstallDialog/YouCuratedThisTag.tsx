import * as React from "react";
import { Icon, types } from "vortex-api";

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
