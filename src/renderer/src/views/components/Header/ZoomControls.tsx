import { mdiMinus, mdiPlus } from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { setZoomFactor } from "@/actions/window";
import { Button } from "@/ui/components/button/Button";
import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP, normalizeZoom, zoomFromState } from "@/util/zoom";

interface IZoomControlsProps {
  inMenu?: boolean;
  onChange?: () => void;
}

export function ZoomControls({ inMenu = false, onChange }: IZoomControlsProps) {
  const factor = useSelector(zoomFromState);
  const dispatch = useDispatch();
  const { t } = useTranslation("common");
  const options = { nsSeparator: ":", keySeparator: "." };
  const adjust = (value: number) => {
    dispatch(setZoomFactor(normalizeZoom(value)));
    onChange?.();
  };
  return (
    <>
      <span
        className={inMenu ? "order-1 min-w-10 text-center" : "mr-2 min-w-10 text-neutral-strong"}
        data-testid={inMenu ? "profile-zoom-percent" : undefined}
      >
        {Math.round(factor * 100)}%
      </span>
      <Button
        appearance="weak"
        brand="neutral"
        size="sm"
        leftIconPath={mdiMinus}
        aria-label={t("common:zoom.out", options)}
        disabled={factor <= MIN_ZOOM}
        onClick={() => adjust(factor - ZOOM_STEP)}
      />
      <Button
        className="order-2"
        appearance="weak"
        brand="neutral"
        size="sm"
        leftIconPath={mdiPlus}
        aria-label={t("common:zoom.in", options)}
        disabled={factor >= MAX_ZOOM}
        onClick={() => adjust(factor + ZOOM_STEP)}
      />
      <Button
        className="order-3"
        appearance="moderate"
        brand="neutral"
        size="sm"
        disabled={factor === 1}
        onClick={() => adjust(1)}
      >
        {t("common:zoom.reset", options)}
      </Button>
    </>
  );
}
