import { IRevision, RatingOptions } from "@nexusmods/nexus-api";
import { useTranslation } from "react-i18next";
import * as React from "react";
import { Button, Checkbox, Form, FormGroup, Radio } from "react-bootstrap";
import {
  FlexLayout,
  Icon,
  RadialProgress,
  tooltip,
  MainContext,
  types,
  Modal,
  Usage,
  selectors,
  util,
} from "vortex-api";
import { NAMESPACE } from "../../constants";
import { useDispatch, useSelector, useStore } from "react-redux";
import { healthDownvoteDialog } from "../../actions/session";
import { IMod, IState } from "vortex-api/lib/types/IState";
import { updateSuccessRate } from "../../actions/persistent";
import * as nexus from "@nexusmods/nexus-api";
import { IConnectedProps } from "vortex-api/lib/views/MainWindow";
import { getSafe } from "vortex-api/lib/util/api";
import { ICollection } from "../../types/ICollection";
import { IStateEx } from "../../types/IStateEx";

export interface IHealthDownvoteDialogProps {}

function HealthDownvoteDialog(props: IHealthDownvoteDialogProps) {
  const [optionValue, setOptionValue] = React.useState(undefined);
  const [confirmationCheck, setConfirmationCheck] = React.useState(false);

  const context = React.useContext(MainContext);

  const { t } = useTranslation(NAMESPACE);
  const dispatch = useDispatch();

  const state = context.api.store.getState();
  const gameId = selectors.activeGameId(state);
  const collectionId: string = useSelector(
    (state: any) => state.session.collections.healthDownvoteDialog ?? undefined,
  );

  const collection: IMod =
    collectionId !== undefined
      ? state.persistent.mods[gameId]?.[collectionId]
      : undefined;

  let revisionInfo: IRevision;
  let collectionInfo;
  let commentLink = "#";
  let bugLink = "#";

  if (collection?.attributes?.revisionId !== undefined) {
    revisionInfo =
      state.persistent.collections.revisions?.[collection.attributes.revisionId]
        ?.info;

    if (revisionInfo?.collection !== undefined) {
      collectionInfo =
        state.persistent.collections.collections?.[revisionInfo.collection.id]
          ?.info;
      commentLink = collectionInfo?.["commentLink"] ?? "#";
      bugLink = !!collectionInfo
        ? `https://next.nexusmods.com/${collectionInfo.game.domainName}/collections/${collectionInfo.slug}?tab=Bugs`
        : "#";
    }
  }

  const hide = React.useCallback(() => {
    // hide dialog by setting it's state value to undefined
    dispatch(healthDownvoteDialog(undefined));
  }, []);

  const downvote = () => {
    sendRating(false);
    hide();
  };

  const onChecked = (evt: React.FormEvent<any>) => {
    setConfirmationCheck(evt.currentTarget.checked);
  };

  const sendRating = async (success: boolean) => {
    const revisionId = collection?.attributes?.revisionId ?? undefined;
    const vote = success ? "positive" : "negative";
    const voted: { success: boolean; averageRating?: nexus.IRating } = (
      await context.api.emitAndAwait(
        "rate-nexus-collection-revision",
        revisionId,
        vote,
      )
    )[0];
    if (voted.success) {
      dispatch(
        updateSuccessRate(
          revisionId,
          vote,
          voted.averageRating.average,
          voted.averageRating.total,
        ),
      );
    }
  };

  return (
    <Modal
      id="collection-health-downvote-dialog"
      className="collection-health-downvote-dialog"
      show={collection !== undefined}
      onHide={hide}
    >
      <Modal.Header>
        <Modal.Title>{t("Downvote Success Rating")}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          {t(
            `Sorry to hear that the collection \"${util.renderModName(collection)}\" isn't working for you. Here are some steps that could help:`,
          )}
        </p>
        <ol>
          <li>
            Make sure your game version matches the game version the collection
            was created for.
          </li>
          <li>
            Read the collection instructions and check if you've missed any
            steps.
          </li>
          <li>
            <a href={commentLink}>Check comments on Nexus Mods</a> for advice
            and to reach out to the collection curator.
          </li>
          <li>
            <a href={bugLink}>View bug reports on Nexus Mods</a> or report a new
            bug to help the curator fix the issue.
          </li>
        </ol>
        <h5>
          {t(
            `Success ratings help others know if a collection installs and runs correctly. They are not a vote on whether you liked the collection or not.`,
          )}
        </h5>
        <FormGroup>
          <Checkbox onChange={onChecked}>
            {t(
              "I have tried the above steps and confirm this collection does not work.",
            )}
          </Checkbox>
        </FormGroup>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={hide}>{t("Cancel")}</Button>
        <Button onClick={downvote} disabled={!confirmationCheck}>
          {t("Submit")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default HealthDownvoteDialog;
