import * as React from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import type { IProfile, IState } from "../../../types/IState";

import { setDialogVisible } from "../../../actions/session";
import { getSafe } from "../../../util/storeHelper";
import ProgressBar from "../../controls/ProgressBar";
import Spinner from "../../controls/Spinner";
import { Dialog } from "../Dialog";
import { DialogContainer } from "../DialogContainer";

export const ProfileSwitcher = (): JSX.Element => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const nextProfileId = useSelector(
    (state: IState) => state.settings.profiles.nextProfileId,
  );
  const profiles = useSelector((state: IState) => state.persistent.profiles);
  const progressProfile = useSelector((state: IState) =>
    getSafe(state.session.base, ["progress", "profile"], undefined),
  );
  const visibleDialog = useSelector(
    (state: IState) => state.session.base.visibleDialog || undefined,
  );

  const onHideDialog = React.useCallback(() => {
    dispatch(setDialogVisible(undefined));
  }, [dispatch]);

  const progress = getSafe(progressProfile, ["deploying"], undefined);
  const profile =
    nextProfileId !== undefined ? profiles[nextProfileId] : undefined;

  const control =
    progress !== undefined ? (
      <ProgressBar
        labelLeft={progress.text}
        now={progress.percent}
        style={{ width: "50%" }}
      />
    ) : (
      <Spinner style={{ width: 64, height: 64 }} />
    );

  return (
    <div key="wait">
      <div className="center-content" style={{ flexDirection: "column" }}>
        <h4>
          {t("Switching to Profile: {{name}}", {
            replace: { name: profile?.name ?? t("None") },
          })}
        </h4>

        {control}
      </div>

      <Dialog />

      <DialogContainer
        visibleDialog={visibleDialog}
        onHideDialog={onHideDialog}
      />
    </div>
  );
};
