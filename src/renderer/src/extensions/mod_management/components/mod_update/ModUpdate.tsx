import { VortexGameId } from "@vortex/shared";
import React from "react";
import { useTranslation } from "react-i18next";

import { useMainContext } from "@/contexts";
import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { Html } from "@/ui/components/prose/html/Html";
import { PlainText } from "@/ui/components/prose/plain_text/PlainText";
import { ToolbarButton } from "@/ui/components/toolbar/ToolbarButton";
import { TitledTooltip } from "@/ui/components/tooltip/TitledTooltip";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { activeGameId } from "@/util/selectors";

import type { IMod } from "../../types/IMod";
import { offersUpdate } from "../../util/mod_has_update/modHasUpdate";
import type { UpdateState } from "../../util/modUpdateState";
import updateState, { isIdValid } from "../../util/modUpdateState";
import { updateMod } from "../../util/update_mod/updateMod";
import { ChangelogButton } from "../changelog_button/ChangelogButton";

interface IModUpdateProps {
  /** The mod the row shows. */
  mod: IMod;
  /** What there is to say about updating it, when the cell has already worked it out. */
  details?: IModUpdateDetails;
}

/** A changelog as the update check stores it, from Nexus Mods. */
interface IChangelog {
  /** How its content is written: HTML, or plain text. */
  format: "html" | "text";
  /** The changelog itself, in that format. */
  content: string;
}

/** What there is to say about updating a mod, worked out once for its Version cell. */
export interface IModUpdateDetails {
  /** Whether Vortex can tell which mod it is, so check it for updates. */
  valid: boolean;
  /** Its update state, as the update check leaves it. */
  state: UpdateState;
  /** Whether there's an update the cell offers, so the row groups under "Update available". */
  hasUpdate: boolean;
  /** The newest version's changelog, unless it's up to date, as a check leaves the last behind. */
  changelog?: IChangelog;
  /** Whether `ModUpdate` shows anything: a warning, a button or a changelog. */
  shows: boolean;
}

export const modUpdateDetails = (mod: IMod): IModUpdateDetails => {
  const valid = isIdValid(mod);
  const attributes = mod.attributes ?? {};
  const state = updateState(attributes);
  const hasUpdate = offersUpdate(state);
  const changelog: IChangelog | undefined =
    state === "current" ? undefined : attributes.newestChangelog;

  return { valid, state, hasUpdate, changelog, shows: !valid || hasUpdate || !!changelog?.content };
};

/**
 * What a mod's Version cell says about updating it, as the legacy table's did: a warning
 * while Vortex can't tell which mod it is, so can't check; otherwise a button to update it,
 * or to open its page to pick the file when the newest can't be told, and the newest
 * version's changelog. Nothing while it's up to date. The bugged states are left out, as
 * nothing marks a version bugged.
 */
export const ModUpdate = ({ mod, details = modUpdateDetails(mod) }: IModUpdateProps) => {
  const { t } = useTranslation("mod_management");
  const { api } = useMainContext();
  const { attributes = {} } = mod;
  const { valid, state, changelog, shows } = details;

  if (!valid) {
    const [title, body, testId] =
      attributes.source === undefined
        ? [
            t("modsTable::update::sourceUnknown::title"),
            t("modsTable::update::sourceUnknown::body"),
            "mod-update-source-unknown",
          ]
        : [
            t("modsTable::update::notIdentified::title"),
            t("modsTable::update::notIdentified::body"),
            "mod-update-not-identified",
          ];

    return (
      <Tooltip customContent={<TitledTooltip body={body} title={title} />}>
        <span
          aria-description={body}
          aria-label={title}
          className="flex size-6 shrink-0 items-center justify-center text-translucent-moderate"
          data-testid={testId}
          role="img"
          tabIndex={0}
        >
          <Icon name="warning" size="sm" />
        </span>
      </Tooltip>
    );
  }

  if (!shows) {
    return null;
  }

  const gameId = () => VortexGameId(attributes.downloadGame ?? activeGameId(api.getState()));

  return (
    <div className="flex shrink-0 items-center gap-x-1">
      {state === "update" && (
        <ToolbarButton
          appearance="moderate"
          brand="info"
          data-testid="mod-update-button"
          label={t("modsTable::update::updateTo", { version: attributes.newestVersion ?? "?" })}
          leftIcon="download"
          size="sm"
          onClick={() => void updateMod(api, mod, gameId())}
        />
      )}

      {state === "update-site" && (
        <Tooltip
          customContent={
            <TitledTooltip
              body={t("modsTable::update::chooseFile::body")}
              title={t("modsTable::update::chooseFile::title")}
            />
          }
          placement="bottom"
        >
          <Button
            appearance="moderate"
            aria-description={t("modsTable::update::chooseFile::body")}
            aria-label={t("modsTable::update::chooseFile::title")}
            brand="info"
            data-testid="mod-update-choose-file"
            leftIcon="unknown_document"
            size="sm"
            onClick={() =>
              api.events.emit("open-mod-page", gameId(), attributes.modId, attributes.source)
            }
          />
        </Tooltip>
      )}

      {!!changelog?.content && (
        <ChangelogButton>
          {changelog.format === "html" ? (
            <Html html={changelog.content} size="sm" />
          ) : (
            <PlainText size="sm" text={changelog.content} />
          )}
        </ChangelogButton>
      )}
    </div>
  );
};
