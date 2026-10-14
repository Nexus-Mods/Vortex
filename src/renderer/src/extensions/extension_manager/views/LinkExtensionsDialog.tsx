import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { CheckboxField } from "@/ui/components/form/checkbox_field/CheckboxField";
import { ModalPanel, ModalWrapper } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";

export interface ILinkCandidate {
  key: string;
  name: string;
  version: string;
  replacementName: string;
  replacementVersion: string;
}

export interface ILinkExtensionsDialogProps {
  visible: boolean;
  candidates: ILinkCandidate[];
  onHide: () => void;
  /** The keys of the selected extensions, or undefined when the user put the question off. */
  onAnswer: (selected: string[] | undefined) => void;
}

const withVersion = (name: string, version: string) =>
  `${name} ${version.startsWith("v") ? version : `v${version}`}`;

export const LinkExtensionsDialog = ({
  visible,
  candidates,
  onHide,
  onAnswer,
}: ILinkExtensionsDialogProps) => {
  const { t } = useTranslation(["extension_manager", "common"]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    setSelected(new Set(candidates.map((candidate) => candidate.key)));
  }, [candidates]);

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const answer = (keys: string[] | undefined) => {
    onAnswer(keys);
    onHide();
  };

  return (
    <ModalWrapper isOpen={visible} onClose={() => answer(undefined)}>
      {/* only the list scrolls once the panel reaches its height cap */}
      <ModalPanel
        className="flex max-h-125 flex-col"
        title={t("linkDialog::title")}
        onClose={() => answer(undefined)}
      >
        <Typography appearance="subdued" as="p" typographyType="body-sm">
          {t("linkDialog::intro")}
        </Typography>

        <Typography appearance="subdued" as="p" className="mt-2" typographyType="body-sm">
          {t("linkDialog::select")}
        </Typography>

        <ul className="mt-4 min-h-0 divide-y divide-stroke-weak overflow-y-auto">
          {candidates.map((candidate) => (
            <li className="py-4 first:pt-0 last:pb-0" key={candidate.key}>
              <CheckboxField
                checked={selected.has(candidate.key)}
                data-testid={`link-extension-${candidate.key}`}
                label={
                  <span className="flex flex-col gap-1">
                    <Typography as="span" typographyType="body-sm">
                      {withVersion(candidate.name, candidate.version)}
                    </Typography>

                    <Typography appearance="subdued" as="span" typographyType="body-sm">
                      {t("linkDialog::replaceWith")}
                    </Typography>

                    <Typography as="span" typographyType="body-sm">
                      {withVersion(candidate.replacementName, candidate.replacementVersion)}
                    </Typography>
                  </span>
                }
                onChange={() => toggle(candidate.key)}
              />
            </li>
          ))}
        </ul>

        <div className="mt-4 flex shrink-0 justify-end gap-2">
          <Button
            appearance="subdued"
            brand="neutral"
            data-testid="link-extensions-later"
            onClick={() => answer(undefined)}
          >
            {t("linkDialog::buttons::later")}
          </Button>

          <Button
            data-testid="link-extensions-update"
            onClick={() =>
              answer(candidates.filter(({ key }) => selected.has(key)).map(({ key }) => key))
            }
          >
            {t("linkDialog::buttons::update")}
          </Button>
        </div>
      </ModalPanel>
    </ModalWrapper>
  );
};
