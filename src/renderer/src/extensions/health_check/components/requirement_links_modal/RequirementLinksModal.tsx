import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { Modal } from "@/ui/components/modal/Modal";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";

import type {
  IMissingRequirement,
  IRequirementLink,
  RequirementLinkChoice,
} from "../../utils/requirementLinks/requirementLinks";
import { MissingRequirementRow } from "./MissingRequirementRow";
import { RequirementNote } from "./RequirementNote";
import { type IToggleButtonOption, ToggleButtonGroup } from "./ToggleButtonGroup";
import { wrongVersionLine } from "./wrongVersionLine";

export interface IRequirementLinksModalProps {
  visible: boolean;
  links: IRequirementLink[];
  /** Requirements nothing installed satisfies, shown under their mods but not linked. */
  missing: IMissingRequirement[];
  onHide: () => void;
  /** The choice for each link by its key, or undefined when the user cancelled. */
  onAnswer: (choices: Map<string, RequirementLinkChoice> | undefined) => void;
}

interface IRequirementGroup {
  sourceModId: string;
  sourceName: string;
  links: IRequirementLink[];
  missing: IMissingRequirement[];
}

/** The requirements grouped by the mod that requires them, in the order they came. */
const bySource = (links: IRequirementLink[], missing: IMissingRequirement[]) => {
  const groups = new Map<string, IRequirementGroup>();
  const groupOf = ({ sourceModId, sourceName }: { sourceModId: string; sourceName: string }) => {
    const group = groups.get(sourceModId) ?? { sourceModId, sourceName, links: [], missing: [] };
    groups.set(sourceModId, group);
    return group;
  };
  for (const link of links) {
    groupOf(link).links.push(link);
  }
  for (const requirement of missing) {
    groupOf(requirement).missing.push(requirement);
  }
  return [...groups.values()];
};

/**
 * Marks a requirement that saving would change, saying why on hover. Every row keeps its space,
 * marked or not, so the link choices line up.
 */
const ChangeMark = ({ reason }: { reason: string | undefined }) => (
  // the whole slot takes the hover, as the mark alone is too small to point at
  <Tooltip content={reason ?? ""} disabled={reason === undefined}>
    <div className="flex h-6 w-2 items-center justify-center">
      {reason !== undefined && (
        <span
          aria-label={reason}
          className="size-1.5 rounded-full bg-primary-moderate"
          data-testid="requirement-change-mark"
          role="img"
        />
      )}
    </div>
  </Tooltip>
);

/**
 * Lists the Nexus requirements of the selected mods, under the mod that requires each, and asks
 * how each one installed is to be linked: as required, as optional, or not at all.
 */
export const RequirementLinksModal = ({
  visible,
  links,
  missing,
  onHide,
  onAnswer,
}: IRequirementLinksModalProps) => {
  const { t } = useTranslation("health_check");
  const [choices, setChoices] = useState<ReadonlyMap<string, RequirementLinkChoice>>(new Map());

  // reset during render, not in an effect, so the opening frame doesn't show the last choices
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setChoices(new Map());
    }
  }

  const groups = useMemo(() => bySource(links, missing), [links, missing]);
  const choiceOf = (link: IRequirementLink) => choices.get(link.key) ?? link.current ?? "requires";
  const options: IToggleButtonOption<RequirementLinkChoice>[] = [
    { value: "requires", label: t("requirement_links_modal::choices::requires") },
    { value: "recommends", label: t("requirement_links_modal::choices::recommends") },
    { value: "ignore", label: t("requirement_links_modal::choices::ignore") },
  ];

  // a new requirement is a change even if left as it is: saving links it, or records the ignore
  const changeReason = (link: IRequirementLink): string | undefined => {
    if (link.current === undefined) {
      return t("requirement_links_modal::change_mark::new");
    }
    if (choiceOf(link) === link.current) {
      return undefined;
    }
    const was = options.find((option) => option.value === link.current)?.label;
    return t("requirement_links_modal::change_mark::changed", { was });
  };
  const changeCount = links.filter((link) => changeReason(link) !== undefined).length;

  const answer = (result: Map<string, RequirementLinkChoice> | undefined) => {
    onAnswer(result);
    onHide();
  };

  return (
    <Modal
      isOpen={visible}
      size="lg"
      title={t("requirement_links_modal::title")}
      onClose={() => answer(undefined)}
    >
      <div className="space-y-2">
        <Typography appearance="subdued" typographyType="body-sm">
          {t("requirement_links_modal::description")}
        </Typography>

        <div className="max-h-96 overflow-y-auto rounded-lg border border-stroke-weak bg-translucent-dark-200 px-4">
          {groups.map((group) => (
            <section className="py-3" key={group.sourceModId}>
              <Typography className="font-semibold" typographyType="body-sm">
                {group.sourceName}
              </Typography>

              <ul className="mt-2 space-y-2 border-l border-stroke-weak pl-3">
                {group.links.map((link) => (
                  <li className="flex items-start justify-between gap-4" key={link.key}>
                    <div className="min-w-0">
                      <Typography typographyType="body-sm">{link.targetName}</Typography>

                      {link.wrongVersion !== undefined && (
                        <Typography
                          appearance="moderate"
                          as="div"
                          brand="warning"
                          data-testid="requirement-wrong-version"
                          typographyType="body-xs"
                        >
                          {wrongVersionLine(link.wrongVersion, t)}
                        </Typography>
                      )}

                      {link.notes !== undefined && <RequirementNote notes={link.notes} />}
                    </div>

                    <div className="flex shrink-0 items-start gap-2">
                      <ChangeMark reason={changeReason(link)} />

                      <ToggleButtonGroup
                        data-testid="requirement-link-choice"
                        label={link.targetName}
                        options={options}
                        value={choiceOf(link)}
                        onChange={(value) =>
                          setChoices((prev) => new Map(prev).set(link.key, value))
                        }
                      />
                    </div>
                  </li>
                ))}

                {group.missing.map((requirement) => (
                  <MissingRequirementRow key={requirement.key} requirement={requirement} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>

      {/* the button layout of ModalLayer's dialogs */}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {links.length === 0 ? (
          // only requirements that aren't installed: nothing to save
          <Button
            appearance="strong"
            brand="neutral"
            data-testid="requirement-links-close"
            onClick={() => answer(undefined)}
          >
            {t("requirement_links_modal::buttons::close")}
          </Button>
        ) : (
          <>
            <Button
              appearance="moderate"
              brand="neutral"
              data-testid="requirement-links-cancel"
              onClick={() => answer(undefined)}
            >
              {t("requirement_links_modal::buttons::cancel")}
            </Button>

            <Button
              data-testid="requirement-links-apply"
              disabled={changeCount === 0}
              onClick={() => answer(new Map(links.map((link) => [link.key, choiceOf(link)])))}
            >
              {t("requirement_links_modal::buttons::save", { count: changeCount })}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
};
