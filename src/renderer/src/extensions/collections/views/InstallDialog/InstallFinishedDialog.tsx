import * as React from "react";
import { Button, Media } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import * as actions from "../../../../actions";
import Modal from "../../../../controls/Modal";
import Spinner from "../../../../controls/Spinner";
import * as tooltip from "../../../../controls/TooltipControls";
import { getGame } from "../../../../extensions/gamemode_management/util/getGame";
import type { IMod } from "../../../../extensions/mod_management/types/IMod";
import { findModByRef } from "../../../../extensions/mod_management/util/findModByRef";
import renderModName from "../../../../extensions/mod_management/util/modName";
import { isOptionalRule } from "../../../../extensions/mod_management/util/testModReference";
import type { ICollectionModInstallInfo } from "../../../../types/collections/ICollectionInstallSession";
import type { IExtensionApi } from "../../../../types/IExtensionContext";
import type { IState } from "../../../../types/IState";
import {
  getFailedOptionalMods,
  getFailedRequiredMods,
} from "../../../../util/collectionInstallSessionSelectors";
import { NAMESPACE } from "../../constants";
import type InstallDriver from "../../util/InstallDriver";
import CollectionThumbnail from "../CollectionTile";
import YouCuratedTag from "./YouCuratedThisTag";

export interface IInstallFinishedDialogProps {
  api: IExtensionApi;
  driver: InstallDriver;
  onClone: (collectionId: string) => Promise<string>;
  editCollection: (id: string) => void;
}

function nop() {
  // nop
}

const emptyObject = {};

function InstallFinishedDialog(props: IInstallFinishedDialogProps) {
  const { api, driver, onClone } = props;
  const { t } = useTranslation(api.NAMESPACE);

  const userInfo = useSelector<IState, { userId: number }>(
    (state) => state.persistent["nexus"]?.userInfo ?? emptyObject,
  );

  const forceUpdate = React.useState(0)[1];

  React.useEffect(() => {
    // dispose on unmount / driver change so the handler doesn't accumulate and later forceUpdate
    // an unmounted dialog (onUpdate returns its unregister fn)
    const dispose = driver.onUpdate(() => {
      if (driver?.collection !== undefined && driver?.step === "review") {
        forceUpdate((i) => i + 1);
      }
    });
    return dispose;
  }, [driver, forceUpdate]);

  const skip = React.useCallback(async () => {
    if (driver.collection !== undefined) {
      await driver.continue();
    }
    forceUpdate((i) => i + 1);
  }, [driver]);

  const showOptionals = React.useCallback(async () => {
    if (driver.collection !== undefined) {
      api.events.emit("view-collection", driver.collection.id, "mods");
      api.store.dispatch(actions.setAttributeFilter("collection-mods", undefined, undefined));
      api.store.dispatch(actions.setAttributeFilter("collection-mods", "required", false));
      await driver.continue();
    }
    forceUpdate((i) => i + 1);
  }, [driver]);

  const installAllOptionals = React.useCallback(() => {
    // double check we're not triggering this multiple times.
    if (driver.step === "review" && driver.collection !== undefined) {
      driver.installRecommended();
    }
    forceUpdate((i) => i + 1);
  }, []);

  // Open the collection's Mods tab filtered to the failed members. Navigate, clear any existing
  // filter, then set the status column ("collection_status") filter to "Failed" (a multi-select
  // OptionsFilter, so the value is an array).
  const viewFailed = React.useCallback(async () => {
    if (driver.collection !== undefined) {
      api.events.emit("view-collection", driver.collection.id, "mods");
      api.store.dispatch(actions.setAttributeFilter("collection-mods", undefined, undefined));
      api.store.dispatch(
        actions.setAttributeFilter("collection-mods", "collection_status", ["Failed"]),
      );
      await driver.continue();
    }
    forceUpdate((i) => i + 1);
  }, [driver]);

  const clone = React.useCallback(async () => {
    if (driver.collection === undefined) {
      return;
    }
    const id: string = await onClone(driver.collection.id);
    if (id !== undefined) {
      props.editCollection(id);
      driver.continue();
    }
  }, [driver, onClone]);

  const collection = driver.collection;

  const mods = useSelector<IState, { [modId: string]: IMod }>((state) =>
    driver.profile !== undefined ? state.persistent.mods[driver.profile?.gameId] : emptyObject,
  );

  const optionals = React.useMemo(() => {
    return (collection?.rules ?? []).filter(
      (rule) => isOptionalRule(rule) && findModByRef(rule.reference, mods) === undefined,
    );
  }, [collection?.rules, mods]);

  const game = driver.profile !== undefined ? getGame(driver.profile.gameId) : undefined;

  const ownCollection: boolean = driver.collectionInfo?.user?.memberId === userInfo?.userId;

  const finalizing = driver.postprocessing;

  // Required members that settled as failed (e.g. a download that failed after a network drop). When
  // any required member failed the collection isn't fully installed, so the dialog switches to an
  // "incomplete" variant: reworded copy, a "View failed mods" action, and the optional-mods / clone
  // actions suppressed - there's no point offering to add optional mods on top of a broken required
  // set.
  const failedRequired = useSelector<IState, ICollectionModInstallInfo[]>(getFailedRequiredMods);
  const hasFailures = failedRequired.length > 0;

  // Optional members the user SELECTED that then failed. A failed optional annotates the result but
  // does not make the collection "incomplete" (that is driven by failedRequired), so it never
  // reworks the title or trims the actions.
  const failedOptional = useSelector<IState, ICollectionModInstallInfo[]>(getFailedOptionalMods);
  const failedCount = failedRequired.length + failedOptional.length;

  return (
    <Modal
      id="install-finished-dialog"
      show={driver.collection !== undefined && driver.step === "review"}
      onHide={nop}
    >
      <Modal.Header>
        <Modal.Title>
          {hasFailures
            ? t("Collection installation incomplete")
            : t("Collection installation complete")}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <div
          className="collection-finished-body"
          style={finalizing ? { opacity: 0.5, pointerEvents: "none" } : undefined}
        >
          <Media.Left>
            <CollectionThumbnail
              collection={driver.collection}
              details={true}
              gameId={driver.profile?.gameId}
              imageTime={42}
              incomplete={hasFailures}
              t={t}
            />
          </Media.Left>

          <Media.Right>
            <h5>{game?.name}</h5>

            <h3>{renderModName(driver.collection)}</h3>

            {driver.collection?.attributes?.shortDescription ?? t("No description")}

            {!hasFailures && ownCollection && optionals.length > 0 ? (
              <div>
                <YouCuratedTag t={t} />

                {t("To edit this collection you must install all of the optional mods")}
              </div>
            ) : null}
          </Media.Right>
        </div>

        {hasFailures ? (
          <div className="collection-finished-failures">
            <div className="collection-finished-optionals-text">
              {t("{{count}} mod could not be installed", { count: failedCount, ns: NAMESPACE })}
            </div>

            <p>
              {t(
                "Some required mods failed to install (for example after a network interruption), " +
                  "so the collection is not fully installed. Review the failed mods to retry them.",
                { ns: NAMESPACE },
              )}
            </p>
          </div>
        ) : optionals.length > 0 ? (
          <div className="collection-finished-optionals">
            <div className="collection-finished-optionals-text">
              {t("{{numOptionals}} optional mods available", {
                replace: { numOptionals: optionals.length },
              })}
            </div>

            <p>
              {t(
                "This collection has {{count}} optional mods which are not required to " +
                  "complete the installation but may provide additional features or options. " +
                  "You can view these mods before installing as they may change the default " +
                  "behavior of the collection or have additional requirements.",
                {
                  count: optionals.length,
                  ns: NAMESPACE,
                },
              )}
            </p>

            <div className="collection-finished-optional-buttons" />
          </div>
        ) : ownCollection ? (
          <div className="collection-can-clone-container">
            <YouCuratedTag t={t} />

            {t(
              "You now have the whole collection installed, you can start editing " +
                "your collection by cloning it.",
            )}

            <tooltip.IconButton
              icon="clone"
              tooltip={t("Clone the collection to the workshop for editing")}
              onClick={clone}
            >
              {t("Edit")}
            </tooltip.IconButton>
          </div>
        ) : null}

        {!hasFailures && failedOptional.length > 0 ? (
          <div className="collection-finished-failures">
            <div className="collection-finished-optionals-text">
              {t("{{count}} optional mod could not be installed", {
                count: failedOptional.length,
                ns: NAMESPACE,
              })}
            </div>
          </div>
        ) : null}

        {finalizing ? (
          <div
            className="collection-finished-finalizing"
            style={{
              display: "flex",
              gap: "8px",
              margin: "8px 0px",
              alignItems: "center",
            }}
          >
            <Spinner />

            <p>{t("Finalizing installation - deploying mods and applying collection rules...")}</p>
          </div>
        ) : null}
      </Modal.Body>

      {hasFailures ? (
        <Modal.Footer>
          <Button disabled={finalizing} onClick={viewFailed}>
            {t("View failed mods")}
          </Button>

          <Button disabled={finalizing} onClick={skip}>
            {t("Close")}
          </Button>
        </Modal.Footer>
      ) : optionals.length > 0 ? (
        <Modal.Footer>
          {failedOptional.length > 0 ? (
            <Button disabled={finalizing} onClick={viewFailed}>
              {t("View failed mods")}
            </Button>
          ) : null}

          <Button disabled={finalizing} onClick={skip}>
            {t("No Thanks")}
          </Button>

          <Button disabled={finalizing} onClick={showOptionals}>
            {t("View optional mods")}
          </Button>

          <Button disabled={finalizing} onClick={installAllOptionals}>
            {t("Install optional mods")}
          </Button>
        </Modal.Footer>
      ) : (
        <Modal.Footer>
          {failedOptional.length > 0 ? (
            <Button disabled={finalizing} onClick={viewFailed}>
              {t("View failed mods")}
            </Button>
          ) : null}

          <Button disabled={finalizing} onClick={skip}>
            {t("Done")}
          </Button>
        </Modal.Footer>
      )}
    </Modal>
  );
}

export default React.memo(InstallFinishedDialog);
