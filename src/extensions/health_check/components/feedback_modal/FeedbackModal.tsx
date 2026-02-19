import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { Checkbox } from "../../../../tailwind/components/form/checkbox";
import { Modal } from "../../../../tailwind/components/modal";
import { Button } from "../../../../renderer/ui/components/button/Button";
import { Typography } from "../../../../renderer/ui/components/typography/Typography";

const FEEDBACK_OPTIONS = [
  "incorrect_requirement",
  "requirement_already_installed",
  "explanation_was_unclear",
  "other",
] as const;

export const FeedbackModal = ({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (reasons: string[]) => void;
}) => {
  const { t } = useTranslation(["health_check"]);
  const [checkedOptions, setCheckedOptions] = useState<string[]>([]);

  return (
    <Modal
      isOpen={isOpen}
      size="sm"
      title={t("detail::feedback_modal::title")}
      onClose={onClose}
    >
      <Typography appearance="subdued" typographyType="body-sm">
        {t("detail::feedback_modal::description")}
      </Typography>

      <div className="mt-4 space-y-2">
        {FEEDBACK_OPTIONS.map((key) => (
          <Checkbox
            checked={checkedOptions.includes(key)}
            key={key}
            onChange={(e) => {
              const isChecked = e.target.checked;
              setCheckedOptions((prev) =>
                isChecked
                  ? [...prev, key]
                  : prev.filter((o) => o !== key),
              );
            }}
          >
            {t(`detail::feedback_modal::options::${key}`)}
          </Checkbox>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-2">
        <Button
          buttonType="tertiary"
          className="w-full"
          filled="weak"
          size="sm"
          onClick={onClose}
        >
          {t("detail::feedback_modal::buttons::cancel")}
        </Button>

        <Button
          buttonType="primary"
          className="w-full"
          size="sm"
          onClick={() => {
            onSuccess(checkedOptions);
          }}
        >
          {t("detail::feedback_modal::buttons::confirm")}
        </Button>
      </div>
    </Modal>
  );
};
