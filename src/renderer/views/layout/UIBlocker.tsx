import { clearUIBlocker } from "../../../actions/session";
import Icon from "../../controls/Icon";
import type { IState } from "../../../types/IState";
import { MainContext } from "../ApplicationLayout";
import * as React from "react";
import { Button as ReactButton } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

export const UIBlocker = (): JSX.Element | null => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { api } = React.useContext(MainContext);

  const uiBlockers = useSelector(
    (state: IState) => state.session.base.uiBlockers,
  );

  const uiBlockerId = React.useMemo(() => {
    return uiBlockers ? Object.keys(uiBlockers)[0] : undefined;
  }, [uiBlockers]);

  const blocker =
    uiBlockerId !== undefined ? uiBlockers[uiBlockerId] : undefined;

  const onUnblock = React.useCallback(
    (evt: React.MouseEvent<any>) => {
      const id = evt.currentTarget.getAttribute("data-id");
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
        <ReactButton data-id={uiBlockerId} onClick={onUnblock}>
          {t("Cancel")}
        </ReactButton>
      ) : null}
    </div>
  );
};
