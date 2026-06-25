import * as React from "react";
import { Button, Media, Panel } from "react-bootstrap";
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
import { log } from "../../../../logging";
import type { IExtensionApi } from "../../../../types/IExtensionContext";
import type { IState } from "../../../../types/IState";
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

  return (
    <Modal
      id="install-finished-dialog"
      show={driver.collection !== undefined && driver.step === "review"}
      onHide={nop}
    >
      <Modal.Header>
        <Modal.Title>{t("Collection installation complete")}</Modal.Title>
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
              t={t}
            />
          </Media.Left>

          <Media.Right>
            <h5>{game?.name}</h5>

            <h3>{renderModName(driver.collection)}</h3>

            {driver.collection?.attributes?.shortDescription ?? t("No description")}

            {ownCollection && optionals.length > 0 ? (
              <div>
                <YouCuratedTag t={t} />

                {t("To edit this collection you must install all of the optional mods")}
              </div>
            ) : null}
          </Media.Right>
        </div>

        {optionals.length > 0 ? (
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

      {optionals.length > 0 ? (
        <Modal.Footer>
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
          <Button disabled={finalizing} onClick={skip}>
            {t("Done")}
          </Button>
        </Modal.Footer>
      )}
    </Modal>
  );
}

export default React.memo(InstallFinishedDialog);
