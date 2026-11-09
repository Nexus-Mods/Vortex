import React, { type ReactNode, useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";

interface IProseSpoilerProps {
  /** What its button says; "Spoiler" if none. */
  label?: string;
  /** What it hides until opened. */
  children: ReactNode;
}

/** Prose hidden behind a button until opened, as bbcode's `[spoiler]`, aligned as its text is. */
export const ProseSpoiler = ({ label, children }: IProseSpoilerProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();

  return (
    <div>
      <Button
        appearance="moderate"
        aria-controls={contentId}
        aria-expanded={isOpen}
        brand="neutral"
        className="inline-flex"
        leftIcon={isOpen ? "keyboard_arrow_up" : "keyboard_arrow_down"}
        onClick={() => setIsOpen(!isOpen)}
      >
        {label || t("Spoiler")}
      </Button>

      {isOpen && (
        <div className="mt-2 rounded-sm border border-stroke-weak px-3 py-2" id={contentId}>
          {children}
        </div>
      )}
    </div>
  );
};
