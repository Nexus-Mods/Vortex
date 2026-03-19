import React from "react";
import { Button, Modal } from "react-bootstrap";
import type { WithTranslation } from "react-i18next";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import Usage from "../../controls/Usage";
import type { IState } from "../../types/IState";
import type { TFunction } from "../../util/i18n";
import relativeTime from "../../util/relativeTime";
import { getGame } from "../gamemode_management/util/getGame";
import type { IHistoryEvent, IHistoryStack } from "./types";
import { unknownToError } from "@vortex/shared";

interface IDialogProps {
  onClose: () => void;
  onReverted: (stack: string, event: IHistoryEvent) => void;
  onError: (err: Error, stack: string, event: IHistoryEvent) => void;
  stackToShow: string;
  stacks: { [key: string]: IHistoryStack };
  events: IHistoryEvent[];
}

function nop() {
  // nop
}

function byAge(lhs: IHistoryEvent, rhs: IHistoryEvent) {
  return rhs.timestamp - lhs.timestamp;
}

interface IHistoryItemProps {
  t: TFunction;
  evt: IHistoryEvent;
  stackId: string;
  stack: IHistoryStack;
  onReverted: (stackId: string, evt: IHistoryEvent) => void;
  onError: (err: Error, stack: string, event: IHistoryEvent) => void;
}

function HistoryItem(props: IHistoryItemProps) {
  const { t, evt, onReverted, onError, stack, stackId } = props;

  const classes = ["history-event-line"];
  const canRevert = evt.reverted ? "invalid" : stack.canRevert(evt);
  if (canRevert === "invalid") {
    classes.push("history-event-invalid");
  }

  const onClick = React.useCallback(() => {
    onReverted(stackId, evt);
    stack
      .revert(evt)
      .catch((err) => onError(unknownToError(err), stackId, evt));
  }, []);

  const game = getGame(evt.gameId);

  const revertDescription = stack.describeRevert(evt);

  return (
    <tr key={evt.id} className={classes.join(" ")}>
      <td className="history-event-time">
        {relativeTime(new Date(evt.timestamp), t)}
      </td>
      <td className="history-event-game">
        {game !== undefined ? (game.shortName ?? game.name) : null}
      </td>
      <td className="history-event-description">{stack.describe(evt)}</td>
      <td className="history-event-revert">
        {revertDescription ? (
          <Button disabled={canRevert !== "yes"} onClick={onClick}>
            {revertDescription}
          </Button>
        ) : null}
      </td>
    </tr>
  );
}

function HistoryDialog(props: IDialogProps & WithTranslation) {
  const { t, events, onClose, onReverted, onError, stacks, stackToShow } =
    props;

  const stack = stacks[stackToShow];

  const sorted = (events ?? []).slice(0).sort(byAge);

  return (
    <Modal id="history-dialog" show={stack !== undefined} onHide={nop}>
      <Modal.Header>
        <h2>{t("Event history")}</h2>
      </Modal.Header>
      <Modal.Body>
        <div className="history-table-container">
          <table>
            <tbody>
              {sorted.map((evt) => (
                <HistoryItem
                  t={t}
                  key={evt.id}
                  evt={evt}
                  stack={stack}
                  stackId={stackToShow}
                  onReverted={onReverted}
                  onError={onError}
                />
              ))}
            </tbody>
          </table>
        </div>
        <Usage className="history-usage" infoId="event-history">
          {t(
            'Please note that this is not "Undo"! This screen allows you to revert ' +
              "specific actions but we make no promises that this actually returns " +
              "Vortex or your game to the state before that action. Not every " +
              "Action can be undone.",
          )}
        </Usage>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onClose}>{t("Close")}</Button>
      </Modal.Footer>
    </Modal>
  );
}

function mapPropsToState(state: IState) {
  const { stackToShow } = state.session.history;

  return {
    stackToShow,
    events:
      stackToShow !== undefined
        ? state.persistent.history.historyStacks[stackToShow]
        : undefined,
  };
}

export default connect(mapPropsToState)(
  withTranslation(["common"])(HistoryDialog as any),
);
