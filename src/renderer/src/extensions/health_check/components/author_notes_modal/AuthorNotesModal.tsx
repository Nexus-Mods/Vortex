import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { Checkbox } from "@/ui/components/form/checkbox/Checkbox";
import { Modal } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";

import { useTracker } from "../../hooks/HealthCheckTracking.context";
import type { IBulkInstallItem } from "../../views/content/types";

interface IAuthorNotesModalProps {
  isOpen: boolean;
  /** Every item the install all would install; only those with a note are listed. */
  items: IBulkInstallItem[];
  onClose: () => void;
  /** Called with the items to install: the unnoted ones plus the noted ones left checked. */
  onInstall: (items: IBulkInstallItem[]) => void;
}

/** Asks before installing requirements whose authors left a note, as those are often optional. */
export const AuthorNotesModal = ({ isOpen, items, onClose, onInstall }: IAuthorNotesModalProps) => {
  const { t } = useTranslation("health_check");
  const {
    trackAuthorNotesModalShown,
    trackAuthorNotesModToggled,
    trackAuthorNotesInstallSelectedClicked,
    trackAuthorNotesCancelClicked,
    trackAuthorNotesClosed,
  } = useTracker();

  const noted = useMemo(() => items.filter((item) => item.notedRequirement), [items]);
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(() => new Set());

  // All checked on each open; reset during render so the opening frame already shows it.
  const [wasOpen, setWasOpen] = useState(isOpen);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);

    if (isOpen) {
      setUnchecked(new Set());
    }
  }

  useEffect(() => {
    if (isOpen) {
      trackAuthorNotesModalShown({ mod_count: noted.length });
    }
    // Only on open: a rescan changing the list shouldn't reset the user's choices.
    // eslint-disable-next-line @eslint-react/exhaustive-deps
  }, [isOpen]);

  // The button counts everything it installs, the unnoted mods included, so N is what happens.
  const toInstall = items.filter((item) => !unchecked.has(item.key));

  const toggle = (item: IBulkInstallItem, checked: boolean) => {
    trackAuthorNotesModToggled({ mod_id: item.notedRequirement.modId, checked });
    setUnchecked((prev) => {
      const next = new Set(prev);

      if (checked) {
        next.delete(item.key);
      } else {
        next.add(item.key);
      }

      return next;
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      size="md"
      title={t("author_notes_modal::title")}
      onClose={() => {
        trackAuthorNotesClosed();
        onClose();
      }}
    >
      <div className="space-y-2">
        <Typography appearance="subdued" typographyType="body-sm">
          {t("author_notes_modal::description")}
        </Typography>

        <Typography className="font-semibold" typographyType="body-sm">
          {t("author_notes_modal::prompt")}
        </Typography>

        <ul className="max-h-80 divide-y divide-stroke-weak overflow-y-auto rounded-lg border border-stroke-weak bg-translucent-dark-200 py-3.5">
          {noted.map((item) => {
            const { modName, note } = item.notedRequirement;
            const requiredFor = item.requiredFor ?? [];

            return (
              <li className="px-4 py-3 first:pt-0 last:pb-0" key={item.key}>
                <Checkbox
                  checked={!unchecked.has(item.key)}
                  className="mb-0"
                  data-testid="health-check-author-note-checkbox"
                  onChange={(e) => toggle(item, e.target.checked)}
                >
                  <Typography
                    appearance="subdued"
                    as="span"
                    className="block"
                    typographyType="body-sm"
                  >
                    <span className="block font-semibold text-neutral-moderate">{modName}</span>

                    <span className="block whitespace-pre-line">{note}</span>

                    <span className="mt-1.5 block">{t("author_notes_modal::required_for")}</span>

                    <span className="block list-disc pl-5" role="list">
                      {requiredFor.map((requiringMod) => (
                        <span className="list-item" key={requiringMod} role="listitem">
                          {requiringMod}
                        </span>
                      ))}
                    </span>
                  </Typography>
                </Checkbox>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-2">
        <Button
          appearance="moderate"
          brand="neutral"
          className="w-full"
          data-testid="health-check-author-notes-cancel"
          onClick={() => {
            trackAuthorNotesCancelClicked();
            onClose();
          }}
        >
          {t("author_notes_modal::buttons::cancel")}
        </Button>

        <Button
          className="w-full"
          data-testid="health-check-author-notes-install"
          disabled={!toInstall.length}
          onClick={() => {
            trackAuthorNotesInstallSelectedClicked({
              selected_count: toInstall.length,
              noted_checked_count: noted.filter((item) => !unchecked.has(item.key)).length,
              mod_count: noted.length,
            });
            onInstall(toInstall);
          }}
        >
          {t("author_notes_modal::buttons::install", { count: toInstall.length })}
        </Button>
      </div>
    </Modal>
  );
};
