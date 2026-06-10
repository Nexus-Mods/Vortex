import * as path from "path";

import type { IRevision } from "@nexusmods/nexus-api";
import * as React from "react";
import { Panel } from "react-bootstrap";

import { Icon, IconBar, Image } from "../../../../controls/api";
import type * as types from "../../../../types/api";
import getVortexPath from "../../../../util/getVortexPath";

export interface IRemoteTileProps {
  t: types.TFunction;
  added?: types.IMod;
  incomplete: boolean;
  revision: IRevision;
  onCloneCollection: (modId: string) => Promise<void>;
  onResumeCollection: (modId: string) => void;
  onInstallCollection: (revision: IRevision) => Promise<void>;
}

function HoverMenu(props: IRemoteTileProps) {
  const {
    t,
    added,
    incomplete,
    revision,
    onCloneCollection,
    onInstallCollection,
    onResumeCollection,
  } = props;

  const installOwnCollection = React.useCallback(() => {
    if (added !== undefined) {
      onResumeCollection(added.id);
    } else {
      onInstallCollection(revision);
    }
  }, [added, revision, onInstallCollection, onResumeCollection]);

  const cloneOwnCollection = React.useCallback(() => {
    onCloneCollection(added.id);
  }, [onCloneCollection, added]);

  const staticElements = [];

  if (added !== undefined && !incomplete) {
    staticElements.push({
      title: "Edit (Requires clone)",
      icon: "edit",
      action: () => cloneOwnCollection(),
    });
  } else {
    staticElements.push(
      {
        title: "Install",
        icon: "install",
        action: () => installOwnCollection(),
      },
      {
        title: "Edit",
        icon: "edit",
        condition: (instanceId: string | string[], data?: any) =>
          t("Your collection must be installed first and then cloned to make edits."),
        action: () => {
          // nop
        },
      },
    );
  }

  staticElements.push();

  return (
    <div className="thumbnail-hover-menu">
      <div className="hover-content" key="primary-buttons">
        <IconBar
          buttonType="both"
          className="buttons"
          clickAnywhere={true}
          collapse={false}
          group="collection-actions"
          id={`collection-thumbnail-${revision.collection.slug}`}
          instanceId={revision.collection.slug}
          orientation="vertical"
          staticElements={staticElements}
          t={t}
        />
      </div>
    </div>
  );
}

function RemoteTile(props: IRemoteTileProps) {
  const { t, revision, onCloneCollection, onInstallCollection, onResumeCollection } = props;

  const classes = ["collection-thumbnail", "collection-remote"];
  const images: string[] = [];
  if (revision.collection.tileImage?.url) {
    images.push(revision.collection.tileImage.url);
  }
  images.push(path.join(getVortexPath("assets"), "images", "collection_fallback_tile.png"));

  return (
    <Panel className={classes.join(" ")}>
      <Panel.Body className="collection-thumbnail-body">
        <Image circle={false} className="thumbnail-img" srcs={images} />

        <div className="bottom">
          <div className="collection-revision-and-rating">
            <div className="revision-number">
              {t("Revision {{number}}", {
                replace: {
                  number: revision.revisionNumber,
                },
              })}
            </div>

            <div className={classes.join(" ")}>
              <Icon name="health" set="collections" />

              {t("{{rating}}%", {
                replace: { rating: revision.rating.average },
              })}
            </div>
          </div>

          <div className="name no-hover">{revision.collection.name}</div>

          <div className="details">
            <div className="author">
              {t("By {{uploader}}", {
                replace: {
                  uploader: revision.collection.user.name,
                },
              })}
            </div>

            <div>
              <Icon name="mods" />

              {revision.modCount ?? revision.modFiles?.length ?? 0}
            </div>
          </div>
        </div>

        <HoverMenu
          added={props.added}
          incomplete={props.incomplete}
          revision={revision}
          t={t}
          onCloneCollection={onCloneCollection}
          onInstallCollection={onInstallCollection}
          onResumeCollection={onResumeCollection}
        />
      </Panel.Body>
    </Panel>
  );
}

export default RemoteTile;
