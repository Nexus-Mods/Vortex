import { Transition } from "@headlessui/react";
import { mdiMinus, mdiPlus } from "@mdi/js";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { setZoomFactor } from "@/actions";
import { Button } from "@/ui/components/button/Button";
import { Typography } from "@/ui/components/typography/Typography";

import {
  MAX_ZOOM,
  MIN_ZOOM,
  normalizeZoom,
  ZOOM_SHORTCUT_EVENT,
  ZOOM_STEP,
  zoomFromState,
} from "../utils/zoom";

const AUTO_HIDE_MS = 3000;

/**
 * A transient readout near the title bar: the permanent control lives in
 * Settings > Interface > Accessibility, but a Ctrl+/-/wheel change gives no
 * feedback on its own, so this appears briefly to show the level (and let it be
 * undone) without sending the user hunting for Settings mid-keystroke.
 *
 * Stays open while the pointer is over it or focus is inside it; closes on its
 * own a few seconds after the last change otherwise.
 */
export function ZoomHotkeyIndicator() {
  const { t } = useTranslation(["common"]);
  const dispatch = useDispatch();
  const factor = useSelector(zoomFromState);

  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState(0);
  const [focusHeld, setFocusHeld] = useState(false);
  const [pointerHeld, setPointerHeld] = useState(false);
  const held = focusHeld || pointerHeld;
  const panelRef = useRef<HTMLDivElement>(null);

  const showBriefly = useCallback(() => {
    setOpen(true);
    setRequest((value) => value + 1);
  }, []);

  useEffect(() => {
    window.addEventListener(ZOOM_SHORTCUT_EVENT, showBriefly);
    return () => window.removeEventListener(ZOOM_SHORTCUT_EVENT, showBriefly);
  }, [showBriefly]);

  useEffect(() => {
    if (!open || held) return;
    const timeout = window.setTimeout(() => setOpen(false), AUTO_HIDE_MS);
    return () => window.clearTimeout(timeout);
  }, [open, request, held]);

  const adjustZoom = (value: number) => {
    dispatch(setZoomFactor(normalizeZoom(value)));
    showBriefly();
  };

  return (
    <Transition
      as="div"
      className="nxm-popover-panel fixed top-12 right-4 z-toast flex w-max min-w-0! items-center gap-x-2 px-2 py-1.5"
      enter="transition-opacity"
      enterFrom="opacity-0 reduce-motion:opacity-100"
      enterTo="opacity-100"
      leave="transition-opacity"
      leaveFrom="opacity-100 reduce-motion:opacity-0"
      leaveTo="opacity-0"
      ref={panelRef}
      role="status"
      show={open}
      style={{ WebkitAppRegion: "no-drag" }}
      onBlur={(event) => {
        if (!panelRef.current?.contains(event.relatedTarget)) setFocusHeld(false);
      }}
      onFocus={(event) => setFocusHeld(!!panelRef.current?.contains(event.target))}
      onPointerEnter={() => setPointerHeld(true)}
      onPointerLeave={() => setPointerHeld(false)}
    >
      <Typography as="span" className="min-w-10 text-center" typographyType="body-sm">
        {t("{{percent}}%", { replace: { percent: Math.round(factor * 100) } })}
      </Typography>

      <Button
        appearance="weak"
        aria-label={t("Zoom out")}
        brand="neutral"
        disabled={factor <= MIN_ZOOM}
        leftIconPath={mdiMinus}
        size="sm"
        onClick={() => adjustZoom(factor - ZOOM_STEP)}
      />

      <Button
        appearance="weak"
        aria-label={t("Zoom in")}
        brand="neutral"
        disabled={factor >= MAX_ZOOM}
        leftIconPath={mdiPlus}
        size="sm"
        onClick={() => adjustZoom(factor + ZOOM_STEP)}
      />

      <Button
        appearance="moderate"
        brand="neutral"
        disabled={factor === 1}
        size="sm"
        onClick={() => adjustZoom(1)}
      >
        {t("Reset")}
      </Button>
    </Transition>
  );
}
