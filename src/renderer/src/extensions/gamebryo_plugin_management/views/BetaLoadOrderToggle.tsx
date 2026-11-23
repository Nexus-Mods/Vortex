import React from "react";
import { useTranslation } from "react-i18next";

import Icon from "../../../controls/Icon";
import { TitledTooltip } from "../../../ui/components/tooltip/TitledTooltip";
import { Tooltip } from "../../../ui/components/tooltip/Tooltip";

interface IBetaLoadOrderToggleProps {
  target: "beta" | "classic";
  onClick: () => void;
}

export function BetaLoadOrderToggle({ target, onClick }: IBetaLoadOrderToggleProps) {
  const { t } = useTranslation();
  const toBeta = target === "beta";
  const title = toBeta ? t("Switch to beta view") : t("Switch to classic view");
  const description = toBeta
    ? t("Try the new load order view. Some features aren't supported yet.")
    : t("Return to the original Plugins view.");

  return (
    <Tooltip customContent={<TitledTooltip title={title} body={description} />} placement="bottom">
      <button
        aria-description={description}
        className={`btn btn-default action-switch-to-${target}-view`}
        type="button"
        onClick={onClick}
      >
        <Icon name="experiment" />
        <div className="button-text">{title}</div>
      </button>
    </Tooltip>
  );
}
