import { Icon } from "@nexusmods/vortex-api";
import * as React from "react";
import { Button, ControlLabel, FormGroup } from "react-bootstrap";
import { useTranslation } from "react-i18next";

const modIcons: string[] = [
  "highlight-conflict",
  "highlight-patch",
  "highlight-shield",
  "highlight-map",
  "highlight-lab",
  "highlight-flag",
  "highlight-temple",
  "highlight-home",
  "highlight-person",
  "highlight-visuals",
  "highlight-tool",
  "highlight-ui",
  "highlight",
];

const cssHighlightList: string[] = [
  "highlight-1",
  "highlight-2",
  "highlight-3",
  "highlight-4",
  "highlight-5",
  "highlight-6",
  "highlight-7",
  "highlight-8",
  "highlight-default",
];

export interface IHighlightPickerProps {
  onSelectColor: (color: string) => void;
  onSelectIcon: (icon: string) => void;
}

/**
 * The themes and icons a mod can be highlighted with, as the highlight popovers and the
 * selected mods' panel offer them.
 */
function HighlightPicker(props: IHighlightPickerProps): JSX.Element {
  const { onSelectColor, onSelectIcon } = props;
  const { t } = useTranslation(["common"]);

  return (
    <FormGroup>
      <ControlLabel>{t("Select theme")}</ControlLabel>
      <div>
        {cssHighlightList.map((highlightColor) => (
          <Button
            type="button"
            key={highlightColor}
            className={"highlight-base " + highlightColor}
            id={highlightColor}
            value={highlightColor}
            onClick={() => onSelectColor(highlightColor)}
          >
            <Icon name={highlightColor === "highlight-default" ? "remove" : "add"} />
          </Button>
        ))}
      </div>
      <ControlLabel>{t("Select mod icon")}</ControlLabel>
      <div className="highlight-icons">
        {modIcons.map((icon) => (
          <Button
            type="button"
            key={icon}
            className="btn-embed"
            id={icon}
            value={icon}
            onClick={() => onSelectIcon(icon)}
          >
            <Icon name={icon} />
          </Button>
        ))}
      </div>
    </FormGroup>
  );
}

export default HighlightPicker;
