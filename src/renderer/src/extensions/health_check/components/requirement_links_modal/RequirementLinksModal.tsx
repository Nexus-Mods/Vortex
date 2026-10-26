import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { Modal } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";

import type {
  IRequirementLink,
  RequirementLinkChoice,
} from "../../utils/requirementLinks/requirementLinks";
import { type IToggleButtonOption, ToggleButtonGroup } from "./ToggleButtonGroup";

export interface IRequirementLinksModalProps {
  visible: boolean;
  links: IRequirementLink[];
  onHide: () => void;
  /** The choice for each link by its key, or undefined when the user cancelled. */
  onAnswer: (choices: Map<string, RequirementLinkChoice> | undefined) => void;
}

/** The links grouped by the mod that requires them, in the order they came. */
const bySource = (links: IRequirementLink[]) => {
  const groups = new Map<string, { sourceName: string; links: IRequirementLink[] }>();
  for (const link of links) {
    const group = groups.get(link.sourceModId) ?? { sourceName: link.sourceName, links: [] };
    group.links.push(link);
    groups.set(link.sourceModId, group);
  }
  return [...groups.values()];
};

/**
 * Lists the Nexus requirements of the selected mods that installed mods satisfy, and asks how
 * each is to be linked: as required, as optional, or not at all. All start as required.
 */
export const RequirementLinksModal = ({
  visible,
  links,
  onHide,
  onAnswer,
}: IRequirementLinksModalProps) => {
  const { t } = useTranslation("health_check");
  const [choices, setChoices] = useState<ReadonlyMap<string, RequirementLinkChoice>>(new Map());

  // All required on each open; reset during render so the opening frame already shows it.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setChoices(new Map());
    }
  }

  const groups = useMemo(() => bySource(links), [links]);
  const choiceOf = (link: IRequirementLink) => choices.get(link.key) ?? "requires";
  const linkCount = links.filter((link) => choiceOf(link) !== "skip").length;

  const options: IToggleButtonOption<RequirementLinkChoice>[] = [
    { value: "requires", label: t("requirement_links_modal::choices::requires") },
    { value: "recommends", label: t("requirement_links_modal::choices::recommends") },
    { value: "skip", label: t("requirement_links_modal::choices::skip") },
  ];

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

        <div className="max-h-96 space-y-4 overflow-y-auto rounded-lg border border-stroke-weak bg-translucent-dark-200 p-4">
          {groups.map((group) => (
            <section key={group.links[0].sourceModId}>
              <Typography className="font-semibold" typographyType="body-sm">
                {t("requirement_links_modal::requires", {
                  replace: { name: group.sourceName },
                })}
              </Typography>

              <ul className="mt-2 divide-y divide-stroke-weak">
                {group.links.map((link) => (
                  <li className="flex items-center justify-between gap-4 py-2" key={link.key}>
                    <Typography appearance="subdued" as="div" typographyType="body-sm">
                      <span className="block text-neutral-moderate">{link.targetName}</span>

                      {link.notes !== undefined && (
                        <span className="block whitespace-pre-line">{link.notes}</span>
                      )}
                    </Typography>

                    <ToggleButtonGroup
                      data-testid="requirement-link-choice"
                      label={link.targetName}
                      options={options}
                      value={choiceOf(link)}
                      onChange={(value) => setChoices((prev) => new Map(prev).set(link.key, value))}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-2">
        <Button
          appearance="moderate"
          brand="neutral"
          className="w-full"
          data-testid="requirement-links-cancel"
          onClick={() => answer(undefined)}
        >
          {t("requirement_links_modal::buttons::cancel")}
        </Button>

        <Button
          className="w-full"
          data-testid="requirement-links-apply"
          disabled={linkCount === 0}
          onClick={() => answer(new Map(links.map((link) => [link.key, choiceOf(link)])))}
        >
          {t("requirement_links_modal::buttons::link", { count: linkCount })}
        </Button>
      </div>
    </Modal>
  );
};
