import type { EndorsedStatus, ICollection, IRevision, RatingOptions } from "@nexusmods/nexus-api";
import type { TFunction } from "i18next";
import * as _ from "lodash";
import * as React from "react";
import { Media, Panel } from "react-bootstrap";

import { MainContext } from "../../../../contexts";
import ActionDropdown from "../../../../controls/ActionDropdown";
import { ComponentEx } from "../../../../controls/ComponentEx";
import FlexLayout from "../../../../controls/FlexLayout";
import Image from "../../../../controls/Image";
import * as tooltip from "../../../../controls/TooltipControls";
import type { IMod } from "../../../../extensions/mod_management/types/IMod";
import renderModName from "../../../../extensions/mod_management/util/modName";
import type { IProfile } from "../../../../extensions/profile_management/types/IProfile";
import { log } from "../../../../logging";
import type { IActionDefinition } from "../../../../types/IActionDefinition";
import type { IDialogResult } from "../../../../types/IDialog";
import type { IExtensionApi } from "../../../../types/IExtensionContext";
import type { TFunction as TFunctionApi } from "../../../../util/i18n";
import opn from "../../../../util/opn";
import * as selectors from "../../../../util/selectors";
import { Campaign, nexusModsURL, Section } from "../../../../util/util";
import { updateCollectionInfo } from "../../actions/persistent";
import { healthDownvoteDialog } from "../../actions/session";
import CollectionReleaseStatus from "../CollectionReleaseStatus";
import CollectionThumbnail from "../CollectionTile";
import HealthIndicator from "./HealthIndicator";

const ENDORSE_DELAY_MS = 43200000; // 12 hours
//const ENDORSE_DELAY_MS = 60000; // 1 minute

interface IEndorseButtonProps {
  t: TFunctionApi;
  mod: IMod;
  collection: ICollection;
  gameId: string;
  voteAllowed: boolean;
}

// NOTE: this way we'll have a compilation error on a new value
const endorsedStatusMap: Record<EndorsedStatus, true> = {
  Undecided: true,
  Abstained: true,
  Endorsed: true,
};
function isEndorsedStatus(value: unknown): value is EndorsedStatus {
  return typeof value === "string" && value in endorsedStatusMap;
}

function EndorseButton(props: IEndorseButtonProps) {
  const { t, collection, gameId, mod, voteAllowed } = props;

  const context = React.useContext(MainContext);

  const endorse = React.useCallback(async () => {
    const rawEndorsedStatus = mod.attributes?.endorsed;
    const endorsedStatus: EndorsedStatus = isEndorsedStatus(rawEndorsedStatus)
      ? rawEndorsedStatus
      : "Undecided";

    context.api.events.emit("endorse-mod", gameId, mod.id, endorsedStatus);
    context.api.events.emit("analytics-track-click-event", "Collections", endorsedStatus);

    setTimeout(async () => {
      refreshCollection(context.api, collection);
    }, 500);

    //const newEndorsementCount = (endorsedStatus === 'Endorsed') ? collection.endorsements - 1 : collection.endorsements + 1;
  }, [mod, collection]);

  const rawEndorsedStatus = mod.attributes?.endorsed;
  const endorsedStatus: EndorsedStatus = isEndorsedStatus(rawEndorsedStatus)
    ? rawEndorsedStatus
    : "Undecided";
  const isBlocked = collection?.viewerIsBlocked ?? false;
  const finalStatus = isBlocked ? "Blocked" : endorsedStatus;
  const endorsed: boolean = mod.attributes?.endorsed === "Endorsed";

  const classes = `collection-ghost-button ${endorsed ? "endorse-yes" : "endorse-maybe"}`;

  const { icon, toolTip } = {
    undecided: { icon: "endorse-maybe", toolTip: t("Undecided") },
    abstained: { icon: "endorse-maybe", toolTip: t("Abstained") },
    endorsed: { icon: "endorse-yes", toolTip: t("Endorsed") },
    disabled: {
      icon: "endorse-disabled",
      toolTip: t("Endorsement disabled by author"),
    },
    pending: { icon: "spinner_new", toolTip: t("Pending") },
    blocked: {
      icon: "endorse-disabled",
      toolTip: t("You have been blocked by the curator."),
    },
  }[finalStatus.toLowerCase()] || {
    icon: "like-maybe",
    toolTip: t("Undecided"),
  };

  return (
    <tooltip.IconButton
      className={classes}
      disabled={!voteAllowed || collection?.endorsements === undefined}
      icon={icon}
      spin={endorsedStatus.toLowerCase() === "pending"}
      tooltip={toolTip}
      onClick={endorse}
    >
      {collection?.endorsements ?? "?"}
    </tooltip.IconButton>
  );
}

interface ICommentButtonProps {
  t: TFunctionApi;
  collection: ICollection;
}

function CommentButton(props: ICommentButtonProps) {
  const { t, collection } = props;
  const context = React.useContext(MainContext);

  const click = React.useCallback(() => {
    if (collection?.["commentLink"] !== undefined) {
      context.api.events.emit("analytics-track-click-event", "Collections", "Comments");
      opn(collection["commentLink"]);
    }
  }, [collection]);

  const tip = collection?.viewerIsBlocked
    ? t("You have been blocked by the curator.")
    : t("Comments");
  return (
    <tooltip.IconButton
      className="collection-ghost-button"
      disabled={collection?.["commentLink"] === undefined || collection?.viewerIsBlocked}
      icon="comments"
      tooltip={tip}
      onClick={click}
    >
      {collection?.forumTopic?.postsCount ?? 0}
    </tooltip.IconButton>
  );
}

async function refreshCollection(api: IExtensionApi, collection: ICollection) {
  if (!collection?.slug) {
    return;
  }

  log("info", `refreshCollection ${collection.slug}`);

  // get collection info from nexus api
  const result: ICollection = (await api.emitAndAwait("get-nexus-collection", collection.slug))[0];

  // update local state with new collection info
  api.store.dispatch(updateCollectionInfo(collection.id.toString(), result, Date.now()));
}

interface ICollectionOverviewProps {
  t: TFunction;
  language: string;
  profile: IProfile;
  collection: IMod;
  totalSize: number;
  revision: IRevision;
  votedSuccess: RatingOptions;
  incomplete: boolean;
  showUpvoteResponse: boolean;
  showDownvoteResponse: boolean;
  onSetEnabled: (enable: boolean) => void;
  onShowMods: () => void;
  onSuppressVoteResponse: (response: "upvote" | "downvote") => void;
  onClose?: () => void;
  onClone?: (collectionId: string) => void;
  onRemove?: (collectionId: string) => void;
  onVoteSuccess?: (collectionId: string, success: boolean) => void;
}

class CollectionOverview extends ComponentEx<ICollectionOverviewProps, { selIdx: number }> {
  private mWorkshopActions: IActionDefinition[];

  constructor(props: ICollectionOverviewProps) {
    super(props);

    this.initState({ selIdx: 0 });

    this.mWorkshopActions = [
      {
        title: "Enable",
        action: this.enable,
        condition: () => {
          const { collection, incomplete, profile } = this.props;
          return !incomplete && profile.modState?.[collection.id]?.enabled !== true;
        },
        icon: "toggle-enabled",
      },
      {
        title: "View on Nexus Mods",
        action: this.openUrl,
        condition: () =>
          this.props.collection.attributes?.collectionSlug !== undefined &&
          this.props.revision !== undefined,
        icon: "open-in-browser",
      },
      {
        title: "Disable",
        action: this.disable,
        condition: () => {
          const { collection, incomplete, profile } = this.props;
          return !incomplete && profile.modState?.[collection.id]?.enabled === true;
        },
        icon: "toggle-disabled",
      },
      {
        title: "Show in Mods",
        action: this.props.onShowMods,
        icon: "inspect",
      },
      {
        title: "Edit (Workshop)",
        action: this.cloneCollection,
        condition: () => this.props.onClone !== undefined,
        icon: "clone",
      },
      {
        title: "Remove",
        action: this.remove,
        condition: () => this.props.onRemove !== undefined,
        icon: "remove",
      },
    ];
  }

  componentDidMount(): void {
    const { revision } = this.props;

    refreshCollection(this.context.api, revision.collection);
  }

  public render(): JSX.Element {
    const { t, collection, incomplete, profile, revision, votedSuccess } = this.props;

    const classes = ["collection-overview"];

    const timeSinceInstall =
      Date.now() -
      new Date(
        collection.attributes?.installCompleted
          ? collection.attributes?.installCompleted
          : (collection.attributes?.installTime ?? 0),
      ).getTime();

    const viewerIsBlocked = revision.collection?.viewerIsBlocked ?? false;
    const voteAllowed = !viewerIsBlocked && timeSinceInstall >= ENDORSE_DELAY_MS;

    const rating = {
      average: parseFloat(revision.collection?.overallRating ?? "100"),
      total: revision.collection?.overallRatingCount ?? 0,
    };

    return (
      <Panel className={classes.join(" ")}>
        <Media>
          <Media.Left>
            <CollectionThumbnail
              collection={collection}
              details={false}
              gameId={profile.gameId}
              imageTime={Date.now()}
              t={t}
            />
          </Media.Left>

          <Media.Body>
            <FlexLayout type="column">
              <FlexLayout.Fixed>
                <div className="collection-overview-title">
                  <div className="collection-title">{renderModName(collection)}</div>

                  <CollectionReleaseStatus
                    active={true}
                    collection={collection}
                    enabled={profile.modState?.[collection.id]?.enabled ?? false}
                    incomplete={incomplete}
                    t={t}
                  />

                  <div className="flex-filler" />
                </div>
              </FlexLayout.Fixed>

              <FlexLayout.Flex className="collection-description-container">
                <div className="collection-description">
                  {collection.attributes?.shortDescription ?? t("No description")}
                </div>
              </FlexLayout.Flex>

              <FlexLayout.Fixed className="collection-page-detail-bar">
                <FlexLayout type="row">
                  <FlexLayout.Fixed className="collection-detail-cell">
                    <FlexLayout type="row">
                      <Image
                        circle
                        srcs={[
                          collection.attributes?.uploaderAvatar ?? "assets/images/noavatar.png",
                        ]}
                      />

                      <div>
                        <div className="title">{t("Curated by")}</div>

                        <div>{collection.attributes?.uploader}</div>
                      </div>
                    </FlexLayout>
                  </FlexLayout.Fixed>

                  <FlexLayout.Fixed className="collection-detail-cell hideable">
                    <div className="title">{t("Revision")}</div>

                    <div>{collection.attributes?.revisionNumber}</div>
                  </FlexLayout.Fixed>

                  <FlexLayout.Fixed className="collection-detail-cell">
                    <div className="title">{t("Last updated")}</div>

                    <div>{this.renderTime(collection.attributes?.updatedTimestamp)}</div>
                  </FlexLayout.Fixed>

                  <FlexLayout.Fixed className="collection-detail-cell hideable">
                    <div className="title">{t("Uploaded")}</div>

                    <div>{this.renderTime(collection.attributes?.uploadedTimestamp)}</div>
                  </FlexLayout.Fixed>

                  {/*
                  <FlexLayout.Fixed className='collection-detail-cell'>
                    <div className='title'>{t('Mods')}</div>
                    <div>{depRules.length}</div>
                  </FlexLayout.Fixed>
                  */}
                  <FlexLayout.Fixed>
                    <EndorseButton
                      collection={revision.collection}
                      gameId={profile.gameId}
                      mod={collection}
                      t={t}
                      voteAllowed={voteAllowed}
                    />
                  </FlexLayout.Fixed>

                  <FlexLayout.Fixed>
                    <CommentButton collection={revision.collection} t={t} />
                  </FlexLayout.Fixed>

                  <FlexLayout.Flex>
                    <div />
                  </FlexLayout.Flex>
                </FlexLayout>
              </FlexLayout.Fixed>
            </FlexLayout>
          </Media.Body>

          <Media.Right>
            <div className="collection-health-container">
              <FlexLayout type="column">
                <FlexLayout.Fixed>
                  {revision?.revisionStatus !== "is_private" ? (
                    <HealthIndicator
                      collectionGameVersion={revision?.gameVersions?.[0]?.reference ?? "?"}
                      gameVersion={
                        (this.context.api.getState().persistent?.gameMode as any)?.versions?.[
                          profile.gameId
                        ] ?? "?"
                      }
                      ownSuccess={votedSuccess}
                      revisionNumber={revision?.revisionNumber ?? 0}
                      t={t}
                      value={rating}
                      voteAllowed={voteAllowed}
                      onVoteSuccess={this.voteSuccess}
                    />
                  ) : null}
                </FlexLayout.Fixed>

                <FlexLayout.Flex>
                  <div className="collection-workshop-actions">
                    <ActionDropdown
                      id="collection-workshop-actions"
                      staticElements={this.mWorkshopActions}
                      t={t}
                    />
                  </div>
                </FlexLayout.Flex>
              </FlexLayout>
            </div>
          </Media.Right>
        </Media>
      </Panel>
    );
  }

  private enable = () => {
    this.props.onSetEnabled(true);
  };

  private disable = () => {
    this.props.onSetEnabled(false);
  };

  private openUrl = () => {
    const { revision } = this.props;
    const { collection } = revision;
    if (
      collection !== undefined &&
      collection.game !== undefined &&
      revision?.revisionNumber !== undefined
    ) {
      this.context.api.events.emit(
        "analytics-track-click-event",
        "Collections",
        "View on site Added Collection",
      );
      opn(
        nexusModsURL(
          [
            collection.game.domainName,
            "collections",
            collection.slug,
            "revisions",
            revision.revisionNumber.toString(),
          ],
          {
            campaign: Campaign.GeneralNavigation,
            section: Section.Collections,
          },
        ),
      );
    }
  };

  private cloneCollection = () => {
    const { onClone, collection } = this.props;
    if (onClone !== undefined && collection !== undefined) {
      onClone(collection.id);
      this.context.api.events.emit("analytics-track-click-event", "Collections", "Clone");
    }
  };

  private remove = () => {
    const { onRemove, collection } = this.props;
    if (onRemove !== undefined && collection !== undefined) {
      onRemove(collection.id);
    }
  };

  private renderTime(timestamp: number): string {
    const { t, language } = this.props;
    if (timestamp === undefined) {
      return t("Never");
    }
    return new Date(timestamp).toLocaleDateString(language);
  }

  private voteSuccess = (success: boolean) => {
    const {
      collection,
      profile,
      revision,
      showDownvoteResponse,
      showUpvoteResponse,
      onSuppressVoteResponse,
      onVoteSuccess,
    } = this.props;

    if (revision.collection === undefined) {
      log("error", "failed to show vote response dialog, missing collection info");
      return;
    }

    const bugLink = `https://next.nexusmods.com/${revision.collection.game.domainName}/collections/${revision.collection.slug}?tab=Bugs`;

    //const state = this.context.api.getState();
    //const gameId = selectors.activeGameId(state);
    //const mods = state.persistent.mods[gameId];

    const rawEndorsedStatus = collection.attributes?.endorsed;
    const endorsedStatus: EndorsedStatus = isEndorsedStatus(rawEndorsedStatus)
      ? rawEndorsedStatus
      : "Undecided";

    if (success && showUpvoteResponse) {
      onVoteSuccess?.(collection.id, success);

      // if we've already endorsed then we don't need to show the dialog
      if (endorsedStatus === "Endorsed") return;

      this.context.api
        .showDialog(
          "question",
          "Collection was successful",
          {
            text:
              "Congratulations! Please consider endorsing this collection if you are enjoying it. " +
              "Endorsing helps others discover this collection and lets the curator know you enjoyed it.",
            checkboxes: [{ id: "dont_show_again", value: false, text: "Don't show again" }],
          },
          [
            { label: "Close" },
            {
              label: "Endorse",
              action: () => {
                this.context.api.events.emit(
                  "endorse-mod",
                  profile.gameId,
                  collection.id,
                  endorsedStatus,
                );
                this.context.api.events.emit(
                  "analytics-track-click-event",
                  "Collections",
                  endorsedStatus,
                );
              },
            },
          ],
        )
        .then((result: IDialogResult) => {
          if (result.input["dont_show_again"]) {
            onSuppressVoteResponse("upvote");
          }
        });
    } else if (!success && showDownvoteResponse) {
      this.context.api.store.dispatch(healthDownvoteDialog(collection.id));

      /*
      this.context.api
        .showDialog(
          'question',
          'Collection assistance - {{collectionName}}',
          {
            bbcode:
              'We are sorry that this collection did not work correctly for you.<br/><br/>' +
              'Please [url="{{commentLink}}"]check the comments[/url] for installation advice and to reach out to the curator.<br/><br/>' +
              'Alternatively, if you believe you have encountered a bug, [url="{{bugLink}}"]view bug reports on Nexus Mods[/url] to see if it has already been reported. ' +
              "If the bug isn't listed, please consider reporting it to help the curator and other users.",
            checkboxes: [
              { id: 'dont_show_again', value: false, text: "Don't show again" },
            ],
            parameters: {
              collectionName: revision.collection.name,
              collectionSlug: revision.collection.slug,
              commentLink: revision.collection.commentLink,
              bugLink,
            },
          },
          [
            { label: 'Close' },
            {
              label: 'View comments',
              action: () => {
                opn(revision.collection.commentLink).catch(() => null);
              },
            },
            {
              label: 'View bugs',
              action: () => {
                opn(bugLink).catch(() => null);
              },
            },
          ],
        )
        .then((result: IDialogResult) => {
          if (result.input['dont_show_again']) {
            onSuppressVoteResponse('downvote');
          }
        });*/
    }
  };
}

export default CollectionOverview;
