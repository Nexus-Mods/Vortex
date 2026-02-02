import React, { useCallback, useMemo, type FC } from "react";
import { Button as ReactButton } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import type { IState } from "../../../types/IState";

import { clearUIBlocker } from "../../../actions/session";
import { useMainContext } from "../../contexts";
import Icon from "../../controls/Icon";

/**
 * Modal overlay that blocks user interaction during certain operations.
 * Displays an icon, description text, and optionally a cancel button.
 * Used during profile switching, game discovery, or other long-running tasks.
 * For both layouts.
 */
export const UIBlocker: FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { api } = useMainContext();

  const uiBlockers = useSelector(
    (state: IState) => state.session.base.uiBlockers,
  );

  const uiBlockerId = useMemo(() => {
    return uiBlockers ? Object.keys(uiBlockers)[0] : undefined;
  }, [uiBlockers]);

  const blocker =
    uiBlockerId !== undefined ? uiBlockers[uiBlockerId] : undefined;

  const onUnblock = useCallback(
    (id: string) => {
      api?.events.emit(`force-unblock-${id}`);
      dispatch(clearUIBlocker(id));
    },
    [api, dispatch],
  );

  if (uiBlockerId === undefined || blocker === undefined) {
    return null;
  }

  return (
    <div className="ui-blocker">
      <Icon name={blocker.icon} />

      <div className="blocker-text">{blocker.description}</div>

      {blocker.mayCancel ? (
        <ReactButton onClick={() => onUnblock(uiBlockerId)}>
          {t("Cancel")}
        </ReactButton>
      ) : null}
    </div>
  );
};
