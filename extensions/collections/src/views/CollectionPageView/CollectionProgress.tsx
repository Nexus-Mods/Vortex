import { IModEx } from "../../types/IModEx";

import CollectionBanner from "./CollectionBanner";

import i18next from "i18next";
import * as React from "react";
import { Panel } from "react-bootstrap";
import {
  ComponentEx,
  FlexLayout,
  ProgressBar,
  Spinner,
  tooltip,
  types,
  util,
} from "vortex-api";
import { calculateCollectionSize, isRelevant } from "../../util/util";

export interface ICollectionProgressProps {
  t: i18next.TFunction;
  isPremium: boolean;
  mods: { [modId: string]: IModEx };
  downloads: { [dlId: string]: types.IDownload };
  profile: types.IProfile;
  totalSize: number;
  activity: { [id: string]: string };
  onCancel: () => void;
  onPause: () => void;
  onResume: () => void;
}

interface ICompState {
  totalSize: number;
}

class CollectionProgress extends ComponentEx<
  ICollectionProgressProps,
  ICompState
> {
  public static getDerivedStateFromProps(props, state) {
    return {
      totalSize: calculateCollectionSize(props.mods),
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
      isPremium,
      mods,
      profile,
      totalSize,
      onCancel,
      onPause,
      onResume,
    } = this.props;

    const group = (mod: types.IMod, download?: types.IDownload): string => {
      if (mod.state === "downloading" && download?.state === "paused") {
        // treating paused downloads as "pending" for the purpose of progress indicator
        return "pending";
      }

      if (mod.state === "installed" && !profile.modState?.[mod.id]?.enabled) {
        return "disabled";
      }

      return (
        {
          null: "pending",
          installed: "done",
          downloaded: "pending",
          installing: "installing",
          downloading: "downloading",
        }[mod.state] ?? "pending"
      );
    };

    interface IModGroups {
      pending: IModEx[];
      downloading: IModEx[];
      installing: IModEx[];
      disabled: IModEx[];
      done: IModEx[];
    }

    const { pending, downloading, installing, disabled, done } = Object.values(
      mods,
    ).reduce<IModGroups>(
      (prev, mod) => {
        if (
          mod.collectionRule.type === "requires" &&
          !mod.collectionRule["ignored"]
        ) {
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
            <FlexLayout type="row" className="collection-progress-flex">
              {(activity["dependencies"] ?? []).length > 0
                ? this.renderActivity(t("Checking Dependencies"))
                : this.renderBars(installing, done)}
              <FlexLayout.Fixed>
                <FlexLayout type="row" className="collection-pause-cancel-flex">
                  {onResume !== undefined ? (
                    <tooltip.IconButton
                      className="btn-embed btn-pause-resume"
                      onClick={onResume}
                      disabled={onResume === null}
                      tooltip={t("Resume")}
                      icon="resume"
                    />
                  ) : null}
                  {onPause !== undefined ? (
                    <tooltip.IconButton
                      className="btn-embed btn-pause-resume"
                      onClick={onPause}
                      tooltip={t("Pause")}
                      icon="pause"
                    />
                  ) : null}
                  <tooltip.IconButton
                    className="btn-embed btn-cancel"
                    onClick={onCancel}
                    icon="stop"
                    tooltip={t("Cancel")}
                  >
                    {t("Cancel")}
                  </tooltip.IconButton>
                </FlexLayout>
              </FlexLayout.Fixed>
            </FlexLayout>
          </Panel>
        </FlexLayout.Flex>
        {isPremium ? null : (
          <FlexLayout.Fixed className="collection-banner-container">
            <CollectionBanner t={t} totalSize={totalSize} />
          </FlexLayout.Fixed>
        )}
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

  private renderBars(installing: IModEx[], done: IModEx[]) {
    const { t, downloads, mods } = this.props;
    const { totalSize } = this.state;

    const curInstall =
      installing.length > 0
        ? installing.find((iter) => iter.state === "installing")
        : undefined;

    const downloadProgress = Object.values(mods).reduce((prev, mod) => {
      let size = 0;
      if (mod.state === "downloading" || mod.state === null) {
        const download = downloads[mod.archiveId];
        size += download?.received || 0;
      } else {
        size += mod.attributes?.fileSize || 0;
      }
      return prev + size;
    }, 0);

    const relevant = Object.values(mods).filter(isRelevant);

    return (
      <>
        <ProgressBar
          now={downloadProgress}
          max={totalSize}
          showPercentage
          labelLeft={t("Downloading")}
          labelRight={`${util.bytesToString(downloadProgress)} / ${util.bytesToString(totalSize)}`}
        />
        <ProgressBar
          now={done.length}
          max={relevant.length}
          showPercentage
          labelLeft={
            installing.length > 0 ? t("Installing") : t("Waiting to install")
          }
          labelRight={
            curInstall !== undefined
              ? util.renderModName(curInstall)
              : undefined
          }
        />
      </>
    );
  }
}

export default CollectionProgress;
