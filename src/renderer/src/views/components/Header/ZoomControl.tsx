import { Transition } from "@headlessui/react";
import { mdiMagnify, mdiMagnifyMinusOutline, mdiMagnifyPlusOutline } from "@mdi/js";
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { Button } from "@/ui/components/button/Button";
import { joinClasses } from "@/ui/utils/joinClasses";
import { zoomFromState, ZOOM_SHORTCUT_EVENT } from "@/util/zoom";

import { ZoomControls } from "./ZoomControls";

export function ZoomControl() {
  const { t } = useTranslation("common");
  const factor = useSelector(zoomFromState);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState(0);
  const translationOptions = { nsSeparator: ":", keySeparator: "." };
  const showBriefly = useCallback(() => {
    setOpen(true);
    setRequest((value) => value + 1);
  }, []);
  const close = useCallback(() => {
    // Only restore focus if a control about to disappear currently owns it.
    // Automatic zoom feedback must never steal focus from the rest of the app.
    if (panelRef.current?.contains(document.activeElement)) buttonRef.current?.focus();
    setOpen(false);
  }, []);

  useEffect(() => {
    window.addEventListener(ZOOM_SHORTCUT_EVENT, showBriefly);
    return () => window.removeEventListener(ZOOM_SHORTCUT_EVENT, showBriefly);
  }, [showBriefly]);

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(close, 3000);
    return () => window.clearTimeout(timeout);
  }, [open, request, close]);

  useEffect(() => {
    if (!open) return;
    const onOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setOpen(false);
        buttonRef.current?.blur();
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", onOutsidePointer, true);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("pointerdown", onOutsidePointer, true);
      window.removeEventListener("keydown", onEscape);
    };
  }, [open, close]);

  const visible = factor !== 1 || open;
  const label = t("common:zoom.current", {
    ...translationOptions,
    percent: Math.round(factor * 100),
  });
  return (
    <div
      className="relative h-7 w-0 shrink-0 transition-[width] has-data-[zoom-visible=true]:w-9"
      data-testid="zoom-control-slot"
      ref={containerRef}
      style={{ WebkitAppRegion: "no-drag" }}
      onBlur={(event) => {
        // Reset becomes disabled at 100%, which blurs it without a new target.
        // Only a real focus move outside should dismiss the feedback early.
        if (event.relatedTarget !== null && !event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <div className="absolute top-0 right-2 w-7" data-zoom-visible={visible}>
        <Transition
          as="div"
          enter="transition-opacity"
          enterFrom="opacity-0 reduce-motion:opacity-100"
          enterTo="opacity-100"
          leave="transition-opacity"
          leaveFrom="opacity-100 reduce-motion:opacity-0"
          leaveTo="opacity-0"
          show={visible}
        >
          <Button
            appearance="weak"
            aria-controls={open ? panelId : undefined}
            aria-expanded={open}
            aria-label={label}
            brand="neutral"
            className={joinClasses("[&_.nxm-button-icon]:size-5", { "opacity-50": factor === 1 })}
            data-testid="zoom-control"
            leftIconPath={
              factor === 1
                ? mdiMagnify
                : factor < 1
                  ? mdiMagnifyMinusOutline
                  : mdiMagnifyPlusOutline
            }
            ref={buttonRef}
            title={label}
            onClick={open ? close : showBriefly}
          />
        </Transition>

        <Transition
          aria-label={t("common:zoom.label", translationOptions)}
          as="div"
          className="nxm-popover-panel absolute top-full left-1/2 mt-1 flex w-max min-w-0! -translate-x-1/2 items-center gap-1 rounded-lg px-2 py-1.5"
          data-testid="zoom-popover"
          enter="transition-opacity"
          enterFrom="opacity-0 reduce-motion:opacity-100"
          enterTo="opacity-100"
          id={panelId}
          leave="transition-opacity"
          leaveFrom="opacity-100 reduce-motion:opacity-0"
          leaveTo="opacity-0"
          ref={panelRef}
          role="group"
          show={open}
        >
          <ZoomControls onChange={showBriefly} />
        </Transition>
      </div>
    </div>
  );
}
