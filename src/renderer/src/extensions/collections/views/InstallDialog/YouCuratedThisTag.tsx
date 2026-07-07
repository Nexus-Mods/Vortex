import * as React from "react";

import Icon from "../../../../controls/Icon";
import type { TFunction } from "../../../../util/i18n";

function Tag(props: { t: TFunction }) {
  const { t } = props;

  return (
    <div className="collections-you-curated-tag">
      <Icon name="completed" />

      {t("You curated this collection")}
    </div>
  );
}

export default Tag;
