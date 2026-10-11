import { unknownToError } from "@vortex/shared";
import React from "react";
import type { WithTranslation } from "react-i18next";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";

import { Button } from "@/ui/components/button/Button";
import { Modal } from "@/ui/components/modal/Modal";
import { joinClasses } from "@/ui/utils/joinClasses";

import Usage from "../../controls/Usage";
import type { IState } from "../../types/IState";
import type { TFunction } from "../../util/i18n";
import relativeTime from "../../util/relativeTime";
import { getGame } from "../gamemode_management/util/getGame";
import type { IHistoryEvent, IHistoryStack } from "./types";

interface IDialogProps {
  onClose: () => void;
  onReverted: (stack: string, event: IHistoryEvent) => void;
  onError: (err: Error, stack: string, event: IHistoryEvent) => void;
  stackToShow: string;
  stacks: { [key: string]: IHistoryStack };
  events: IHistoryEvent[];
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

  const canRevert = evt.reverted ? "invalid" : stack.canRevert(evt);

  const onClick = React.useCallback(() => {
    onReverted(stackId, evt);
    stack.revert(evt).catch((err) => onError(unknownToError(err), stackId, evt));
  }, []);

  const game = getGame(evt.gameId);

  const revertDescription = stack.describeRevert(evt);

  return (
    <tr
      className={joinClasses(["h-10"], { "opacity-80": canRevert === "invalid" })}
      data-testid="history-event"
      key={evt.id}
    >
      <td className="min-w-40 pl-3">{relativeTime(new Date(evt.timestamp), t)}</td>
      <td className="min-w-40">{game !== undefined ? (game.shortName ?? game.name) : null}</td>
      <td className="px-4">{stack.describe(evt)}</td>
      <td className="pr-3">
        {revertDescription ? (
          <Button
            className="w-full"
            data-testid="history-revert"
            disabled={canRevert !== "yes"}
            size="sm"
            onClick={onClick}
          >
            {revertDescription}
          </Button>
        ) : null}
      </td>
    </tr>
  );
}

export function HistoryDialog(props: IDialogProps & WithTranslation) {
  const { t, events, onClose, onReverted, onError, stacks, stackToShow } = props;

  const stack = stacks[stackToShow];

  const sorted = (events ?? []).slice(0).sort(byAge);

  return (
    <Modal
      isOpen={stack !== undefined}
      showCloseButton={false}
      size="xl"
      title={t("Event history")}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full">
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
        <Usage infoId="event-history">
          <div className="p-2">
            {t(
              'Please note that this is not "Undo"! This screen allows you to revert ' +
                "specific actions but we make no promises that this actually returns " +
                "Vortex or your game to the state before that action. Not every " +
                "Action can be undone.",
            )}
          </div>
        </Usage>
      </div>

      <div className="mt-4 flex justify-end">
        <Button appearance="moderate" brand="neutral" data-testid="history-close" onClick={onClose}>
          {t("Close")}
        </Button>
      </div>
    </Modal>
  );
}

function mapPropsToState(state: IState) {
  const { stackToShow } = state.session.history;

  return {
    stackToShow,
    events:
      stackToShow !== undefined ? state.persistent.history.historyStacks[stackToShow] : undefined,
  };
}

export default connect(mapPropsToState)(withTranslation(["common"])(HistoryDialog as any));
