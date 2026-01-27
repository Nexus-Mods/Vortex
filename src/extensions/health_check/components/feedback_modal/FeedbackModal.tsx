import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { Checkbox } from "../../../../tailwind/components/form/checkbox";
import { Modal } from "../../../../tailwind/components/modal";
import { Button } from "../../../../tailwind/components/next/button";
import { Typography } from "../../../../tailwind/components/next/typography";

export const FeedbackModal = ({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
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
        {[
          t("detail::feedback_modal::options::incorrect_requirement"),
          t("detail::feedback_modal::options::requirement_already_installed"),
          t("detail::feedback_modal::options::explanation_was_unclear"),
          t("detail::feedback_modal::options::other"),
        ].map((option) => (
          <Checkbox
            checked={checkedOptions.includes(option)}
            key={option}
            onChange={(e) => {
              const isChecked = e.target.checked;
              setCheckedOptions((prev) =>
                isChecked
                  ? [...prev, option]
                  : prev.filter((o) => o !== option),
              );
            }}
          >
            {option}
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
            // todo:
            //  send checkedOptions to mixpanel,
            //  can set loading={true} while awaiting request, prevents sending data twice and indicates state to user
            onSuccess();
          }}
        >
          {t("detail::feedback_modal::buttons::confirm")}
        </Button>
      </div>
    </Modal>
  );
};
