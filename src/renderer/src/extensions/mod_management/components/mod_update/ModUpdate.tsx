import { mdiAlertOutline, mdiFileQuestionOutline, mdiTrayArrowDown } from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";

import { useMainContext } from "@/contexts";
import { Html } from "@/ui/components/html/Html";
import { Icon } from "@/ui/components/icon/Icon";
import { Markdown } from "@/ui/components/markdown/Markdown";
import { ToolbarButton } from "@/ui/components/toolbar/ToolbarButton";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { activeGameId } from "@/util/selectors";

import type { IMod } from "../../types/IMod";
import updateState, { isIdValid } from "../../util/modUpdateState";
import { ChangelogButton } from "../changelog_button/ChangelogButton";

interface IModUpdateProps {
  /** The mod the row shows. */
  mod: IMod;
}

/** A changelog as the update check stores it, from Nexus Mods. */
interface IChangelog {
  format: "html" | "text";
  content: string;
}

/**
 * What there is to say about updating a mod: its update state, and the newest version's
 * changelog while there's an update, as a check that finds none leaves the last one behind.
 */
const updateDetails = (mod: IMod) => {
  const attributes = mod.attributes ?? {};
  const state = updateState(attributes);
  const changelog: IChangelog | undefined =
    state === "current" ? undefined : attributes.newestChangelog;

  return { state, changelog };
};

/** Whether `ModUpdate` shows anything for a mod: a warning, a button or a changelog. */
export const modUpdateShows = (mod: IMod) => {
  if (!isIdValid(mod)) {
    return true;
  }

  const { state, changelog } = updateDetails(mod);
  return state === "update" || state === "update-site" || !!changelog?.content;
};

/**
 * What a mod's Version cell says about updating it, as the legacy table's did: a warning
 * while Vortex can't tell which mod it is, so can't check; otherwise a button to update it,
 * or to open its page to pick the file when the newest can't be told, and the newest
 * version's changelog. Nothing while it's up to date. The bugged states are left out, as
 * nothing marks a version bugged.
 */
export const ModUpdate = ({ mod }: IModUpdateProps) => {
  const { t } = useTranslation(["common"]);
  const { api } = useMainContext();
  const { attributes = {} } = mod;

  if (!isIdValid(mod)) {
    const warning =
      attributes.source === undefined
        ? t(
            "This mod has no source assigned. The source tells Vortex where the mod " +
              "came from and, if applicable, where to check for updates. " +
              'You can set the source to "Other" to disable this warning.',
          )
        : t(
            "This mod is missing identification information. Without this some " +
              "features like checking for updates or adding this mod to collections " +
              "will not work.",
          );

    return (
      <Tooltip content={warning}>
        <span
          aria-label={warning}
          className="flex size-6 shrink-0 items-center justify-center text-translucent-moderate"
          role="img"
          tabIndex={0}
        >
          <Icon path={mdiAlertOutline} size="sm" />
        </span>
      </Tooltip>
    );
  }

  if (!modUpdateShows(mod)) {
    return null;
  }

  const { state, changelog } = updateDetails(mod);
  const gameId = () => attributes.downloadGame ?? activeGameId(api.getState());

  return (
    <div className="flex shrink-0 items-center gap-x-1">
      {state === "update" && (
        <ToolbarButton
          appearance="moderate"
          brand="info"
          label={t("Mod can be updated (Current version: {{newVersion}})", {
            newVersion: attributes.newestVersion ?? "?",
          })}
          leftIconPath={mdiTrayArrowDown}
          size="sm"
          onClick={() =>
            api.events.emit(
              "mod-update",
              gameId(),
              attributes.modId,
              attributes.newestFileId,
              attributes.source,
            )
          }
        />
      )}

      {state === "update-site" && (
        <ToolbarButton
          appearance="moderate"
          brand="info"
          label={t("Mod can be updated (but you will have to pick the file yourself)")}
          leftIconPath={mdiFileQuestionOutline}
          size="sm"
          onClick={() =>
            api.events.emit("open-mod-page", gameId(), attributes.modId, attributes.source)
          }
        />
      )}

      {!!changelog?.content && (
        <ChangelogButton title={attributes.newestVersion ?? t("Newest version")}>
          {changelog.format === "html" ? (
            <Html html={changelog.content} />
          ) : (
            <Markdown markdown={changelog.content} />
          )}
        </ChangelogButton>
      )}
    </div>
  );
};
