import { IModEx } from "../../types/IModEx";
import CollectionModDetails from "./CollectionModDetails";
import CollectionReleaseStatus from "../CollectionReleaseStatus";
import SlideshowControls from "./SlideshowControls";

import { ICollectionRevisionMod } from "@nexusmods/nexus-api";
import i18next from "i18next";
import * as _ from "lodash";
import * as React from "react";
import { Image as BSImage, Media, Panel } from "react-bootstrap";
import { ComponentEx, tooltip, types, util } from "vortex-api";

interface ICollectionOverviewProps {
  t: i18next.TFunction;
  profile: types.IProfile;
  collection: types.IMod;
  incomplete: boolean;
  modSelection: Array<{ local: IModEx; remote: ICollectionRevisionMod }>;
  onDeselectMods?: () => void;
}

class CollectionOverview extends ComponentEx<
  ICollectionOverviewProps,
  { selIdx: number }
> {
  constructor(props: ICollectionOverviewProps) {
    super(props);

    this.initState({ selIdx: 0 });
  }

  public render(): JSX.Element {
    const { t, collection, incomplete, modSelection, profile } = this.props;

    let { selIdx } = this.state;
    if (selIdx >= modSelection.length) {
      selIdx = 0;
    }

    const modDetails = modSelection.length > 0;

    const classes = ["collection-overview"];
    if (modDetails) {
      classes.push("collection-mod-selection");
    }

    return (
      <Panel className={classes.join(" ")}>
        <div className="collection-overview-title">
          <div className="collection-title">
            {util.renderModName(collection)}
          </div>
          <CollectionReleaseStatus
            t={t}
            active={true}
            enabled={profile.modState?.[collection.id]?.enabled ?? false}
            collection={collection}
            incomplete={incomplete}
          />
          {modSelection.length > 1 ? (
            <>
              <SlideshowControls
                t={t}
                numItems={modSelection.length}
                onChangeItem={this.setSelection}
                autoProgressTimeMS={5000}
              />
              <div className="flex-filler" />
              <tooltip.IconButton
                className="btn-embed"
                tooltip={t("Deselects mods")}
                icon="close"
                onClick={this.props.onDeselectMods}
              />
            </>
          ) : null}
        </div>
        <CollectionModDetails
          t={t}
          local={modSelection[selIdx]?.local}
          remote={modSelection[selIdx]?.remote}
          gameId={profile.gameId}
        />
      </Panel>
    );
  }

  private setSelection = (idx: number) => {
    this.nextState.selIdx =
      this.props.modSelection.length === 0
        ? 0
        : idx % this.props.modSelection.length;
  };
}

export default CollectionOverview;
