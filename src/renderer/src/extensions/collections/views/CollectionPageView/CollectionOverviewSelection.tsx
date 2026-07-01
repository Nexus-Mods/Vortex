import type { ICollectionRevisionMod } from "@nexusmods/nexus-api";
import type { TFunction } from "i18next";
import * as _ from "lodash";
import * as React from "react";
import { Image as BSImage, Media, Panel } from "react-bootstrap";

import { ComponentEx } from "../../../../controls/ComponentEx";
import * as tooltip from "../../../../controls/TooltipControls";
import type { IMod } from "../../../../extensions/mod_management/types/IMod";
import renderModName from "../../../../extensions/mod_management/util/modName";
import type { IProfile } from "../../../../extensions/profile_management/types/IProfile";
import type { IModEx } from "../../types/IModEx";
import CollectionReleaseStatus from "../CollectionReleaseStatus";
import CollectionModDetails from "./CollectionModDetails";
import SlideshowControls from "./SlideshowControls";

interface ICollectionOverviewProps {
  t: TFunction;
  profile: IProfile;
  collection: IMod;
  incomplete: boolean;
  modSelection: Array<{ local: IModEx; remote: ICollectionRevisionMod }>;
  onDeselectMods?: () => void;
}

class CollectionOverview extends ComponentEx<ICollectionOverviewProps, { selIdx: number }> {
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
          <div className="collection-title">{renderModName(collection)}</div>

          <CollectionReleaseStatus
            active={true}
            collection={collection}
            enabled={profile.modState?.[collection.id]?.enabled ?? false}
            incomplete={incomplete}
            t={t}
          />

          {modSelection.length > 1 ? (
            <>
              <SlideshowControls
                autoProgressTimeMS={5000}
                numItems={modSelection.length}
                t={t}
                onChangeItem={this.setSelection}
              />

              <div className="flex-filler" />

              <tooltip.IconButton
                className="btn-embed"
                icon="close"
                tooltip={t("Deselects mods")}
                onClick={this.props.onDeselectMods}
              />
            </>
          ) : null}
        </div>

        <CollectionModDetails
          gameId={profile.gameId}
          local={modSelection[selIdx]?.local}
          remote={modSelection[selIdx]?.remote}
          t={t}
        />
      </Panel>
    );
  }

  private setSelection = (idx: number) => {
    this.nextState.selIdx =
      this.props.modSelection.length === 0 ? 0 : idx % this.props.modSelection.length;
  };
}

export default CollectionOverview;
