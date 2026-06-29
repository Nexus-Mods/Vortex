import type { TFunction } from "i18next";
import * as React from "react";
import { Panel } from "react-bootstrap";

import { ComponentEx } from "../../../../controls/ComponentEx";
import FlexLayout from "../../../../controls/FlexLayout";
import ProgressBar from "../../../../controls/ProgressBar";
import Spinner from "../../../../controls/Spinner";
import * as tooltip from "../../../../controls/TooltipControls";
import { bytesToString } from "../../../../util/util";
import type { IDownload } from "../../../download_management/types/IDownload";
import renderModName from "../../../mod_management/util/modName";
import { isRequiredRule } from "../../../mod_management/util/testModReference";
import type { IProfile } from "../../../profile_management/types/IProfile";
import type { ICollectionItemRow } from "../../installSession/itemRows";
import CollectionBanner from "./CollectionBanner";

// a row counts towards the collection's progress/size if it has been acted on, or is a
// not-yet-started required (non-ignored) mod (status-based equivalent of util.isRelevant)
function itemRelevant(mod: ICollectionItemRow): boolean {
  if (mod.status !== "pending" && mod.status !== "optional") {
    return true;
  }
  if (mod.collectionRule.ignored) {
    return false;
  }
  return isRequiredRule(mod.collectionRule);
}

function itemsSize(mods: Record<string, ICollectionItemRow>): number {
  return Object.values(mods).reduce((prev, mod) => {
    if (!itemRelevant(mod)) {
      return prev;
    }
    return prev + (mod.attributes?.fileSize ?? mod.collectionRule.reference.fileSize ?? 0);
  }, 0);
}

export interface ICollectionProgressProps {
  t: TFunction;
  showPremiumAd: boolean;
  // keyed by rule id
  mods: Record<string, ICollectionItemRow>;
  downloads: { [dlId: string]: IDownload };
  profile: IProfile;
  totalSize: number;
  activity: { [id: string]: string };
  onCancel: () => void;
  onPause: () => void;
  onResume: () => void;
}

interface ICompState {
  totalSize: number;
}

class CollectionProgress extends ComponentEx<ICollectionProgressProps, ICompState> {
  public static getDerivedStateFromProps(props: ICollectionProgressProps) {
    return {
      totalSize: itemsSize(props.mods),
    };
  }

  constructor(props: ICollectionProgressProps) {
    super(props);
    this.initState({
      totalSize: 0,
    });
  }

  public render(): JSX.Element {
    const {
      t,
      activity,
      downloads,
      showPremiumAd,
      mods,
      profile,
      totalSize,
      onCancel,
      onPause,
      onResume,
    } = this.props;

    const group = (mod: ICollectionItemRow, download?: IDownload): string => {
      if (mod.status === "downloading" && download?.state === "paused") {
        // treating paused downloads as "pending" for the purpose of progress indicator
        return "pending";
      }

      if (mod.status === "installed" && !profile.modState?.[mod.id]?.enabled) {
        return "disabled";
      }

      switch (mod.status) {
        case "installed":
          return "done";
        case "failed":
          // a failed required mod is terminal: count it as done so the bar can complete
          return "done";
        case "installing":
          return "installing";
        case "downloading":
          return "downloading";
        default:
          // pending / downloaded / optional
          return "pending";
      }
    };

    interface IModGroups {
      pending: ICollectionItemRow[];
      downloading: ICollectionItemRow[];
      installing: ICollectionItemRow[];
      disabled: ICollectionItemRow[];
      done: ICollectionItemRow[];
    }

    const { pending, downloading, installing, disabled, done } = Object.values(
      mods,
    ).reduce<IModGroups>(
      (prev, mod) => {
        if (isRequiredRule(mod.collectionRule) && !mod.collectionRule.ignored) {
          prev[group(mod, downloads[mod.archiveId])].push(mod);
        }
        return prev;
      },
      { pending: [], downloading: [], installing: [], disabled: [], done: [] },
    );

    if (
      downloading.length === 0 &&
      installing.length === 0 &&
      pending.length === 0 &&
      disabled.length === 0
    ) {
      return null;
    }

    return (
      <FlexLayout type="row">
        <FlexLayout.Flex>
          <Panel>
            <FlexLayout className="collection-progress-flex" type="row">
              {(activity["dependencies"] ?? []).length > 0
                ? this.renderActivity(t("Checking Dependencies"))
                : this.renderBars(installing, done)}

              <FlexLayout.Fixed>
                <FlexLayout className="collection-pause-cancel-flex" type="row">
                  {onResume !== undefined ? (
                    <tooltip.IconButton
                      className="btn-embed btn-pause-resume"
                      disabled={onResume === null}
                      icon="resume"
                      tooltip={t("Resume")}
                      onClick={onResume}
                    />
                  ) : null}

                  {onPause !== undefined ? (
                    <tooltip.IconButton
                      className="btn-embed btn-pause-resume"
                      icon="pause"
                      tooltip={t("Pause")}
                      onClick={onPause}
                    />
                  ) : null}

                  <tooltip.IconButton
                    className="btn-embed btn-cancel"
                    icon="stop"
                    tooltip={t("Cancel")}
                    onClick={onCancel}
                  >
                    {t("Cancel")}
                  </tooltip.IconButton>
                </FlexLayout>
              </FlexLayout.Fixed>
            </FlexLayout>
          </Panel>
        </FlexLayout.Flex>

        {showPremiumAd ? (
          <FlexLayout.Fixed className="collection-banner-container">
            <CollectionBanner t={t} totalSize={totalSize} />
          </FlexLayout.Fixed>
        ) : null}
      </FlexLayout>
    );
  }

  private renderActivity(message: string) {
    return (
      <FlexLayout.Flex>
        <Spinner /> {message}
      </FlexLayout.Flex>
    );
  }

  private renderBars(installing: ICollectionItemRow[], done: ICollectionItemRow[]) {
    const { t, downloads, mods } = this.props;
    const { totalSize } = this.state;

    const curInstall =
      installing.length > 0 ? installing.find((iter) => iter.status === "installing") : undefined;

    const downloadProgress = Object.values(mods).reduce((prev, mod) => {
      let size = 0;
      if (mod.status === "downloading" || mod.status === "pending") {
        const download = downloads[mod.archiveId];
        size += download?.received || 0;
      } else {
        size += mod.attributes?.fileSize || 0;
      }
      return prev + size;
    }, 0);

    const relevant = Object.values(mods).filter(itemRelevant);

    return (
      <>
        <ProgressBar
          showPercentage
          labelLeft={t("Downloading")}
          labelRight={`${bytesToString(downloadProgress)} / ${bytesToString(totalSize)}`}
          max={totalSize}
          now={downloadProgress}
        />

        <ProgressBar
          showPercentage
          labelLeft={installing.length > 0 ? t("Installing") : t("Waiting to install")}
          labelRight={curInstall !== undefined ? renderModName(curInstall) : undefined}
          max={relevant.length}
          now={done.length}
        />
      </>
    );
  }
}

export default CollectionProgress;
