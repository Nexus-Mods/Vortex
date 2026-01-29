import I18next from "i18next";
import memoizeOne from "memoize-one";
import * as path from "path";
import * as React from "react";
import { FormControl, FormGroup, Panel } from "react-bootstrap";
import { connect } from "react-redux";
import * as Redux from "redux";
import {
  actions,
  ComponentEx,
  Icon,
  IconBar,
  Image,
  selectors,
  tooltip,
  types,
  util,
} from "vortex-api";
import {
  AUTHOR_UNKNOWN,
  MAX_COLLECTION_NAME_LENGTH,
  MIN_COLLECTION_NAME_LENGTH,
} from "../../constants";
import InfoCache from "../../util/InfoCache";
import CollectionReleaseStatus from "../CollectionReleaseStatus";
import NewRevisionMarker from "./NewRevisionMarker";
import { SuccessRating } from "./SuccessRating";

export interface IBaseProps {
  t: I18next.TFunction;
  className?: string;
  gameId: string;
  installing?: types.IMod;
  collection: types.IMod;
  infoCache?: InfoCache;
  mods?: { [modId: string]: types.IMod };
  incomplete?: boolean;
  details: boolean | "some";
  forceRevisionDisplay?: number;
  imageTime: number;
  onResume?: (modId: string) => void;
  onPause?: (modId: string) => void;
  onEdit?: (modId: string) => void;
  onView?: (modId: string) => void;
  onRemove?: (modId: string) => void;
  onUpload?: (modId: string) => void;
  onUpdate?: (moidId: string) => Promise<void>;
}

interface IConnectedProps {
  profile: types.IProfile;
}

interface IActionProps {
  onSetModAttribute: (
    gameId: string,
    modId: string,
    key: string,
    value: any,
  ) => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

interface IModNameFieldProps {
  t: types.TFunction;
  name: string;
  onChange: (name: string) => void;
}

function ModNameField(props: IModNameFieldProps) {
  const { t, name, onChange } = props;

  const [editing, setEditing] = React.useState(false);
  const [tempName, setTempName] = React.useState(name);

  const changeInput = React.useCallback(
    (evt: React.FormEvent<any>) => {
      setTempName(evt.currentTarget.value.slice(0, MAX_COLLECTION_NAME_LENGTH));
    },
    [setTempName],
  );

  const validationState = React.useCallback(() => {
    if (
      tempName.length < MIN_COLLECTION_NAME_LENGTH ||
      tempName.length > MAX_COLLECTION_NAME_LENGTH
    ) {
      return "error";
    } else {
      return "success";
    }
  }, [tempName]);

  const apply = React.useCallback(() => {
    if (validationState() === "success") {
      onChange(tempName);
      setEditing(false);
    }
  }, [setEditing, tempName]);

  const keyPress = React.useCallback(
    (evt: React.KeyboardEvent<any>) => {
      if (evt.key === "Enter") {
        apply();
      }
    },
    [apply],
  );

  const startEdit = React.useCallback(() => {
    setEditing(true);
  }, [setEditing]);

  return (
    <div className={`collection-name ${editing ? "editing" : "displaying"}`}>
      {editing ? (
        <>
          <FormGroup
            controlId="formBasicText"
            validationState={validationState()}
          >
            <FormControl
              type="text"
              value={tempName}
              placeholder={t("Collection Name")}
              onChange={changeInput}
              autoFocus={true}
              onKeyPress={keyPress}
            />
          </FormGroup>
          <tooltip.IconButton
            icon="input-confirm"
            tooltip={t("Save name")}
            onClick={apply}
          />
        </>
      ) : (
        <>
          <div className="name">{tempName}</div>
          <tooltip.IconButton
            icon="edit"
            tooltip={t("Change name")}
            onClick={startEdit}
          />
        </>
      )}
    </div>
  );
}

class CollectionThumbnail extends ComponentEx<IProps, { updating: boolean }> {
  private imageURLs = memoizeOne((collection: types.IMod) =>
    [
      collection.attributes?.pictureUrl,
      path.join(__dirname, "fallback_tile.png"),
    ].filter((iter) => iter !== undefined),
  );

  public constructor(props: IProps) {
    super(props);

    this.initState({
      updating: false,
    });
  }

  public render(): JSX.Element {
    const {
      t,
      collection,
      details,
      infoCache,
      incomplete,
      mods,
      onEdit,
      profile,
      forceRevisionDisplay,
    } = this.props;

    if (collection === undefined) {
      return null;
    }

    const active = util.getSafe(
      profile,
      ["modState", collection.id, "enabled"],
      false,
    );

    const refMods: types.IModRule[] = (collection.rules ?? []).filter((rule) =>
      ["requires", "recommends"].includes(rule.type),
    );

    const totalSize: number = Object.values(collection.rules ?? []).reduce(
      (prev, rule) => {
        if (rule.reference.fileSize !== undefined) {
          return prev + rule.reference.fileSize;
        } else if (rule.reference.id !== undefined && mods !== undefined) {
          return prev + (mods[rule.reference.id]?.attributes?.fileSize ?? 0);
        } else {
          return prev;
        }
      },
      0,
    );

    const classes = ["collection-thumbnail"];

    const hasMenu = this.actions.length > 0;

    if (this.props.className !== undefined) {
      classes.push(this.props.className);
    }

    if (hasMenu) {
      classes.push("has-menu");
    }

    const { revisionId, collectionSlug, revisionNumber } =
      collection.attributes ?? {};

    const validRemote =
      revisionId !== undefined &&
      collectionSlug !== undefined &&
      revisionNumber !== undefined;

    return (
      <Panel
        className={classes.join(" ")}
        bsStyle={active ? "primary" : "default"}
      >
        <Panel.Body className="collection-thumbnail-body">
          {details === true ? (
            <NewRevisionMarker
              t={t}
              collection={collection}
              updating={this.state.updating}
            />
          ) : null}
          <Image
            className="thumbnail-img"
            srcs={this.imageURLs(collection)}
            circle={false}
          />
          {details !== false ? <div className="gradient" /> : null}

          {details !== false ? (
            <div className={`bottom ${onEdit !== undefined ? "editable" : ""}`}>
              <CollectionReleaseStatus
                t={t}
                active={active}
                enabled={profile?.modState?.[collection.id]?.enabled ?? false}
                collection={collection}
                incomplete={incomplete}
              />
              <div className="collection-revision-and-rating">
                <div className="revision-number">
                  {t("Revision {{number}}{{forceRevision}}", {
                    replace: {
                      number: collection.attributes?.version ?? "0",
                      forceRevision:
                        forceRevisionDisplay === undefined
                          ? ""
                          : " ➔ " + forceRevisionDisplay,
                    },
                  })}
                </div>
                {infoCache !== undefined && validRemote ? (
                  <SuccessRating
                    t={t}
                    infoCache={infoCache}
                    collectionSlug={collectionSlug}
                    revisionNumber={revisionNumber}
                    revisionId={revisionId}
                  />
                ) : null}
              </div>
              <div className="name no-hover">
                {util.renderModName(collection, { version: false })}
              </div>
              {onEdit !== undefined ? (
                <div className="hover">
                  <ModNameField
                    t={t}
                    name={util.renderModName(collection, { version: false })}
                    onChange={this.changeName}
                  />
                </div>
              ) : null}
              <div className="details">
                <div className="author">
                  {/*
                  <BSImage
                    src={collection.attributes?.uploaderAvatar ?? 'assets/images/noavatar.png'}
                    circle
                  />
                  */}
                  {t("By {{uploader}}", {
                    replace: {
                      uploader:
                        collection.attributes?.uploader ?? t(AUTHOR_UNKNOWN),
                    },
                  })}
                </div>
                <div>
                  <Icon name="mods" />
                  {refMods.length}
                </div>
                {/*<div><Icon name='archive' />{util.bytesToString(totalSize)}</div>*/}
              </div>
            </div>
          ) : null}
          {hasMenu ? (
            <div className="thumbnail-hover-menu">
              {this.renderMenu(refMods, totalSize)}
            </div>
          ) : null}
        </Panel.Body>
      </Panel>
    );
  }

  private invoke<T>(action: (inst: string) => T, inst: string[]): T {
    if (action !== undefined && inst !== undefined && inst.length > 0) {
      return action(inst[0]);
    }
  }

  private get actions() {
    const {
      t,
      collection,
      incomplete,
      installing,
      onEdit,
      onPause,
      onUpload,
      onRemove,
      onResume,
      onUpdate,
      onView,
    } = this.props;

    const result: types.IActionDefinition[] = [];

    if (onUpdate) {
      result.push({
        title: "Update",
        icon: "auto-update",
        group: "optional",
        condition: () => {
          const { attributes } = this.props.collection;
          if (this.state.updating) {
            return t("Already updating");
          }
          return (
            attributes?.newestVersion !== undefined &&
            parseInt(attributes.newestVersion, 10) >
              parseInt(attributes.version, 10)
          );
        },
        action: (instanceIds: string[]) => {
          const prom = this.invoke(onUpdate, instanceIds);
          if (prom !== undefined) {
            this.nextState.updating = true;
            prom
              .catch((err) => {
                if (!(err instanceof util.UserCanceled)) {
                  this.context.api.showErrorNotification(
                    "Failed to update collection",
                    err,
                  );
                }
              })
              .finally(() => {
                this.nextState.updating = false;
              });
          }
        },
      } as any);
    }
    if (onView) {
      result.push({
        title: "View",
        icon: "show",
        action: (instanceIds: string[]) => {
          this.invoke(onView, instanceIds);
        },
      });
      if (incomplete && onResume !== undefined) {
        result.push({
          title: "Resume",
          icon: "resume",
          condition: () => {
            if (installing === undefined) {
              return true;
            }
            return installing.id === collection.id
              ? false
              : (t("Another collection is being installed") as string);
          },
          action: (instanceIds: string[]) => {
            if (onResume !== undefined) {
              this.invoke(onResume, instanceIds);
            }
            this.invoke(onView, instanceIds);
          },
        });
      }
      if (incomplete && onPause !== undefined) {
        result.push({
          title: "Pause",
          icon: "pause",
          condition: () => installing?.id === collection.id,
          action: (instanceIds: string[]) => {
            this.invoke(onPause, instanceIds);
            this.invoke(onView, instanceIds);
          },
        });
      }
    }
    if (onEdit) {
      result.push({
        title: "Edit",
        icon: "edit",
        action: (instanceIds: string[]) => this.invoke(onEdit, instanceIds),
      });
    }
    if (onRemove) {
      result.push({
        title: "Remove",
        icon: "remove",
        action: (instanceIds: string[]) => this.invoke(onRemove, instanceIds),
      });
    }

    if (onUpload) {
      const nextRev = collection.attributes?.revisionNumber;

      result.push({
        title: t(nextRev !== undefined ? "Upload Update" : "Upload New"),
        icon: "upload",
        action: (instanceIds: string[]) => this.invoke(onUpload, instanceIds),
        condition: () => {
          const refMods: types.IModRule[] = (collection.rules ?? []).filter(
            (rule) => ["requires", "recommends"].includes(rule.type),
          );
          if (refMods.length === 0) {
            return this.props.t("Can't upload an empty collection") as string;
          } else {
            return true;
          }
        },
      });
    }

    return result;
  }

  private renderMenu(
    refMods: types.IModRule[],
    totalSize: number,
  ): JSX.Element[] {
    const { t, collection } = this.props;

    return [
      <div key="primary-buttons" className="hover-content">
        <IconBar
          id={`collection-thumbnail-${collection.id}`}
          className="buttons"
          group="collection-actions"
          instanceId={collection.id}
          staticElements={this.actions}
          collapse={false}
          buttonType="both"
          orientation="vertical"
          clickAnywhere={true}
          t={t}
        />
      </div>,
    ];
  }

  private changeName = (name: string) => {
    const { collection, onSetModAttribute, profile } = this.props;

    onSetModAttribute(profile.gameId, collection.id, "customFileName", name);
  };
}

const emptyObj = {};

function mapStateToProps(
  state: types.IState,
  ownProps: IBaseProps,
): IConnectedProps {
  return {
    profile: selectors.activeProfile(state),
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch): IActionProps {
  return {
    onSetModAttribute: (
      gameId: string,
      modId: string,
      key: string,
      value: any,
    ) => dispatch(actions.setModAttribute(gameId, modId, key, value)),
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(CollectionThumbnail) as any as React.ComponentType<IBaseProps>;
