import { mdiContentSave, mdiRefresh } from "@mdi/js";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Button } from "@/ui/components/button/Button";
import { Input } from "@/ui/components/form/input/Input";
import { Listing } from "@/ui/components/listing/Listing";
import { Typography } from "@/ui/components/typography/Typography";

import useNexusModsSearch from "../hooks/NexusModsSearch";
import type { IModResult } from "../util/searchMods";
import FloatingSearchBarNoResults from "./FloatingSearchBarNoResults";
import FloatingSearchBarResult from "./FloatingSearchBarResult";
import FloatingSearchBarSkeletonTile from "./FloatingSearchBarSkeletonTile";

export default function FloatingSearchBar({
  visible,
  leftPct,
  topPct,
  containerRef,
  onClose,
  onSelect,
}: {
  visible: boolean;
  leftPct: number; // 0..1
  topPct: number; // 0..1
  containerRef: React.RefObject<HTMLElement | null>;
  initial?: string;
  onClose: () => void;
  onSelect: (result: IModResult, comment: string) => void;
}) {
  const [q, setQ] = useState("");
  const [selectedMod, setSelectedMod] = useState<IModResult | null>(null);
  const [comment, setComment] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties | null>(null);
  const [placeAbove, setPlaceAbove] = useState(false);

  const { isLoading, isError, error, results } = useNexusModsSearch(q, {
    tryToUseLogin: true,
    debounceDelayMs: 500,
  });

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [onClose]);

  useEffect(() => {
    if (!visible) {
      setSelectedMod(null);
      setComment("");
      setQ("");
    }
  }, [visible]);

  useLayoutEffect(() => {
    if (!visible || !containerRef?.current || !ref.current) {
      setPopupStyle(null);
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const targetX = leftPct * containerRect.width;
    const targetY = topPct * containerRect.height;
    const margin = 8;
    const width = Math.min(320, Math.max(160, containerRect.width - margin * 2));

    const left = Math.min(
      Math.max(targetX, margin + width / 2),
      containerRect.width - margin - width / 2,
    );

    const availableAbove = targetY - margin;
    const availableBelow = containerRect.height - targetY - margin;
    const shouldPlaceAbove = availableBelow < 240 && availableAbove > availableBelow;
    const top = shouldPlaceAbove ? undefined : targetY + margin;
    const bottom = shouldPlaceAbove ? containerRect.height - targetY + margin : undefined;

    setPlaceAbove(shouldPlaceAbove);
    setPopupStyle({
      position: "absolute",
      left,
      top,
      bottom,
      transform: "translateX(-50%)",
      zIndex: 1000,
      width,
      maxWidth: "100%",
    });
  }, [visible, leftPct, topPct, containerRef]);

  if (!visible) return null;

  const fallbackLeft = `${Math.max(2, Math.min(98, leftPct * 100))}%`;
  const fallbackTop = `${Math.max(2, Math.min(98, topPct * 100))}%`;
  const style = popupStyle ?? {
    position: "absolute",
    left: fallbackLeft,
    top: fallbackTop,
    transform: "translate(-50%,-110%)",
    zIndex: 1000,
    width: 320,
    maxWidth: "100%",
  };

  return (
    <div
      className="rounded-sm bg-surface-high p-2 shadow-sm"
      ref={ref}
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={`relative bg-surface-high ${!selectedMod && placeAbove ? "flex flex-col-reverse" : ""}`}
      >
        {!selectedMod && (
          <Input
            autoFocus
            className={`mb-0 w-full border px-2 py-1 ${placeAbove ? "rounded-b-sm border-t-0" : "rounded-t-sm border-b-0"}`}
            disabled={!!selectedMod}
            placeholder="Search for mods..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && !selectedMod && results[0]) setSelectedMod(results[0]);
            }}
          />
        )}

        {selectedMod && (
          <div className="space-y-2">
            <div className="bg-surface flex gap-2 rounded-sm border p-2">
              <img
                className="aspect-mod w-24 rounded-sm"
                src={selectedMod.adult ? selectedMod.thumbnailBlurredUrl : selectedMod.thumbnailUrl}
              />

              <Typography appearance="strong" brand="primary" typographyType="body-md">
                {selectedMod.name}
              </Typography>
            </div>

            <Input
              autoFocus
              placeholder="Optional comment"
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && selectedMod ? onSelect(selectedMod, comment) : null
              }
            />

            <div className="flex items-center gap-2">
              <Button
                appearance="moderate"
                brand="neutral"
                leftIconPath={mdiRefresh}
                size="sm"
                type="button"
                onClick={() => {
                  setSelectedMod(null);
                  setComment("");
                }}
              >
                Change mod
              </Button>

              <Button
                appearance="strong"
                brand="primary"
                leftIconPath={mdiContentSave}
                size="sm"
                type="button"
                onClick={() => {
                  if (selectedMod) onSelect(selectedMod, comment);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        )}

        {!selectedMod && (
          <div
            className={`border-surface-border h-24 w-full overflow-auto bg-surface-high shadow-[0_8px_24px_rgba(0,0,0,0.08)] ${placeAbove ? "rounded-t-sm border-b-0" : "rounded-b-sm border-t-0"}`}
          >
            <Listing
              className="mt-2 h-24"
              customNoResults={<FloatingSearchBarNoResults query={q} />}
              entityCount={results.length}
              errorTitle={error?.message}
              isError={isError}
              isLoading={isLoading}
              skeletonCount={5}
              SkeletonTile={FloatingSearchBarSkeletonTile}
            >
              {results.map((r) => (
                <FloatingSearchBarResult
                  key={String(r.uid)}
                  result={r}
                  onClick={() => setSelectedMod(r)}
                />
              ))}
            </Listing>
          </div>
        )}
      </div>
    </div>
  );
}
