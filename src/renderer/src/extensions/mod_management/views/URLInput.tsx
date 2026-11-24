import React, { useCallback } from "react";
import { useDispatch } from "react-redux";

import FlexLayout from "../../../controls/FlexLayout";
import FormInput from "../../../controls/FormInput";
import { IconButton } from "../../../controls/TooltipControls";
import type { TFunction } from "../../../util/i18n";
import { setModAttribute } from "../actions/mods";
import type { IMod } from "../types/IMod";
import { isUrlValid } from "../util/is_url_valid/isUrlValid";

export interface IURLInputProps {
  t: TFunction;
  gameId: string;
  mod: IMod;
}

function URLInput(props: IURLInputProps) {
  const { t, gameId, mod } = props;

  const dispatch = useDispatch();

  const updateURL = useCallback(
    (newUrl: string) => {
      dispatch(setModAttribute(gameId, mod.id, "url", newUrl));
    },
    [gameId, mod],
  );

  const openSite = useCallback(() => {
    window.api.shell.openUrl(mod.attributes?.url);
  }, [mod]);

  return (
    <FlexLayout type="row">
      <FormInput style={{ flex: "1 1 0" }} value={mod.attributes?.url} onChange={updateURL} />
      <IconButton
        data-testid="open-mod-website"
        icon="open-in-browser"
        disabled={!isUrlValid(mod.attributes?.url)}
        tooltip={t("Open website in your browser")}
        onClick={openSite}
      />
    </FlexLayout>
  );
}

export default URLInput;
