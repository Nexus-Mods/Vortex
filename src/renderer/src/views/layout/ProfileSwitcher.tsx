import React, { useCallback, type FC } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import type { IState } from "../../types/IState";

import { setDialogVisible } from "../../actions/session";
import ProgressBar from "../../controls/ProgressBar";
import Spinner from "../../controls/Spinner";
import {
  nextProfileId as nextProfileIdSelector,
  profileById as profileByIdSelector,
} from "../../util/selectors";
import { Dialog } from "../Dialog";
import { DialogContainer } from "../DialogContainer";

/**
 * Provides a profile switcher component.
 * For both layouts.
 */
export const ProfileSwitcher: FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const nextProfileId = useSelector(nextProfileIdSelector);
  const progressProfile = useSelector(
    (state: IState) => state.session.base.progress?.profile,
  );
  const visibleDialog = useSelector(
    (state: IState) => state.session.base.visibleDialog || undefined,
  );

  const onHideDialog = useCallback(() => {
    dispatch(setDialogVisible(undefined));
  }, [dispatch]);

  const deploying = progressProfile?.deploying;
  const profile = useSelector((state: IState) =>
    nextProfileId !== undefined
      ? profileByIdSelector(state, nextProfileId)
      : undefined,
  );

  const control = deploying ? (
    <ProgressBar
      labelLeft={deploying.text}
      now={deploying.percent}
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
