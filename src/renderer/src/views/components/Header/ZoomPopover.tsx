import { Transition } from "@headlessui/react";
import { mdiMagnify, mdiMagnifyMinusOutline, mdiMagnifyPlusOutline } from "@mdi/js";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { PopoverButton } from "@/ui/components/popover/PopoverButton";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";
import { joinClasses } from "@/ui/utils/joinClasses";
import { zoomFromState, ZOOM_SHORTCUT_EVENT } from "@/util/zoom";

import { ZoomControls } from "./ZoomControls";

export function ZoomPopover({ close, open }: { close: () => void; open: boolean }) {
  const { t } = useTranslation("common");
  const factor = useSelector(zoomFromState);
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const openingFromShortcut = useRef(false);
  const [shortcutRequest, setShortcutRequest] = useState(0);
  const [shortcutVisible, setShortcutVisible] = useState(false);
  const translationOptions = { nsSeparator: ":", keySeparator: "." };
  const showBriefly = () => {
    setShortcutVisible(true);
    setShortcutRequest((request) => request + 1);
  };

  useEffect(() => {
    const onShortcut = () => {
      setShortcutVisible(true);
      setShortcutRequest((request) => request + 1);
    };
    window.addEventListener(ZOOM_SHORTCUT_EVENT, onShortcut);
    return () => window.removeEventListener(ZOOM_SHORTCUT_EVENT, onShortcut);
  }, []);

  useEffect(() => {
    if (shortcutRequest === 0) return;
    const timeout = window.setTimeout(() => {
      close();
      setShortcutVisible(false);
    }, 3000);
    return () => window.clearTimeout(timeout);
  }, [shortcutRequest, close]);

  // Transition mounts the trigger after the visibility update. Open once that
  // trigger exists, without restarting the shortcut's dismissal timer.
  useEffect(() => {
    if (shortcutVisible && button?.getAttribute("aria-expanded") !== "true") {
      openingFromShortcut.current = true;
      button?.click();
      openingFromShortcut.current = false;
    }
  }, [shortcutRequest, shortcutVisible, button]);

  useEffect(() => {
    if (!open) return;
    const onOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        close();
        // Pointer dismissal should not leave the trigger focused and highlighted.
        // Keyboard dismissal still uses Headless UI's normal focus restoration.
        button?.blur();
      }
    };
    window.addEventListener("pointerdown", onOutsidePointer, true);
    return () => window.removeEventListener("pointerdown", onOutsidePointer, true);
  }, [open, close, button]);

  const visible = factor !== 1 || shortcutVisible;
  const label = t("common:zoom.current", {
    ...translationOptions,
    percent: Math.round(factor * 100),
  });
  return (
    <div className="absolute top-0 right-2 w-7" data-zoom-visible={visible} ref={containerRef}>
      <Transition
        as="div"
        show={visible}
        enter="transition-opacity"
        enterFrom="opacity-0 reduce-motion:opacity-100"
        enterTo="opacity-100"
        leave="transition-opacity"
        leaveFrom="opacity-100 reduce-motion:opacity-0"
        leaveTo="opacity-0"
      >
        <PopoverButton
          appearance="weak"
          aria-label={label}
          brand="neutral"
          className={joinClasses("[&_.nxm-button-icon]:size-5", { "opacity-50": factor === 1 })}
          data-testid="zoom-control"
          leftIconPath={
            factor === 1 ? mdiMagnify : factor < 1 ? mdiMagnifyMinusOutline : mdiMagnifyPlusOutline
          }
          ref={setButton}
          title={label}
          onClick={() => {
            if (!open && !openingFromShortcut.current) showBriefly();
          }}
        />
      </Transition>
      <PopoverPanel
        transition
        anchor={null}
        aria-label={t("common:zoom.label", translationOptions)}
        className="absolute top-full left-1/2 mt-1 flex w-max min-w-0! -translate-x-1/2 items-center gap-1 rounded-lg px-2 py-1.5 transition-opacity data-closed:opacity-0"
        data-testid="zoom-popover"
        portal={false}
        role="group"
      >
        <ZoomControls onChange={showBriefly} />
      </PopoverPanel>
    </div>
  );
}
