import { VortexGameId } from "@vortex/shared";
import type { TFunction } from "i18next";
import * as React from "react";
import { ListGroupItem, Media } from "react-bootstrap";
import { Provider } from "react-redux";

import Icon from "@/controls/Icon";
import { numericNexusGameId } from "@/extensions/analytics/mixpanel/numericGameId";
import type { IAvailableExtension } from "@/types/extensions";
import { Image } from "@/ui/components/image/Image";
import { Popover } from "@/ui/components/popover/Popover";
import { PopoverButton } from "@/ui/components/popover/PopoverButton";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";

import { ComponentEx } from "../../../controls/ComponentEx";
import IconBar from "../../../controls/IconBar";
import type { IActionDefinition } from "../../../types/IActionDefinition";
import type { IMod } from "../../mod_management/types/IMod";
import {
  clearGameAddStore,
  setGameAddExtension,
  setGameAddOrigin,
  setGameAddStore,
} from "../actions/session";
import type { IGameSection } from "../components/GameCard";
import { TierZeroRowBadge } from "../components/TierZeroIndicator";
import type { GameSource } from "../types/GameSource";
import type { IDiscoveryResult } from "../types/IDiscoveryResult";
import type { IGameStored } from "../types/IGameStored";
import { gameArtURL } from "../util/gameArtURL";
import {
  createGamesPageTracker,
  PRIMARY_ACTION_BY_SECTION,
  type TileActionPlacement,
} from "../util/games_page_tracker/gamesPageTracker";
import GameInfoPopover from "./GameInfoPopover";

export interface IProps {
  t: TFunction;
  /** A tile for a game nothing is registered for carries the catalog's extension for it */
  game: IGameStored & { extension?: IAvailableExtension };
  discovery?: IDiscoveryResult;
  /**
   * The store the detected-games response matched the game on, named until discovery
   * finds the game and names the store itself.
   */
  detectedStore?: string;
  mods?: { [modId: string]: IMod };
  active: boolean;
  type: string;
  /** Which Games page list the row is in, recorded for the app_game_manage event. */
  source?: GameSource;
  /** The Games page section the row is in, for the row's analytics. */
  section: IGameSection;
  onRefreshGameInfo: (gameId: string) => PromiseLike<void>;
  onBrowseGameLocation: (gameId: string) => PromiseLike<void>;
}

/**
 * thumbnail + controls for a single game mode within the game picker
 *
 * @class GameThumbnail
 */
class GameRow extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, active, discovery, game, onRefreshGameInfo, type } = this.props;

    if (game === undefined) {
      return null;
    }

    const imgurl = gameArtURL(game);

    const location =
      discovery !== undefined && discovery.path !== undefined ? (
        <a onClick={this.openLocation}>{discovery.path}</a>
      ) : null;

    const classes = ["game-list-item"];
    if (active) {
      classes.push("game-list-selected");
    }
    if (discovery === undefined) {
      classes.push("game-list-undiscovered");
    }

    return (
      <ListGroupItem className={classes.join(" ")} onClickCapture={this.tagOrigin}>
        <Media>
          <Media.Left>
            <div className="game-thumbnail-container-list">
              <Image
                className="w-12"
                imageType="game"
                fit="cover"
                src={imgurl}
                alt={game.name}
                loading="lazy"
                decoding="async"
              />
            </div>
          </Media.Left>

          <Media.Body>
            <Media.Heading>{t(game.name.replace(/\t/g, " "))}</Media.Heading>

            <TierZeroRowBadge game={game} />

            {location !== null ? (
              <p>
                {t("Location")}: {location}
              </p>
            ) : null}
          </Media.Body>

          <Media.Right>
            {/* `contents` so the wrapper the popover needs doesn't split the row. */}
            <Popover className="contents">
              {({ open }) => (
                <>
                  <Tooltip content={t("Show Details")} disabled={open} placement="bottom">
                    <PopoverButton
                      appearance="weak"
                      aria-label={t("Show Details")}
                      brand="neutral"
                      className="btn-embed"
                      id={`btn-info-${game.id}`}
                      leftIcon={<Icon name="game-menu" />}
                    />
                  </Tooltip>

                  <PopoverPanel anchor={{ gap: 8, to: "bottom end" }} className="popover-game-info">
                    <div className="popover-content" onClickCapture={this.reportHideToggle}>
                      <Provider store={this.context.api.store}>
                        <IconBar
                          buttonType="text"
                          className="buttons"
                          collapse={false}
                          filter={this.lowPriorityButtons}
                          group={`game-${type}-buttons`}
                          id={`game-thumbnail-${game.id}`}
                          instanceId={game.id}
                          orientation="vertical"
                          staticElements={[]}
                          t={t}
                          onAction={this.reportMenuAction}
                        />

                        <GameInfoPopover game={game} t={t} onRefreshGameInfo={onRefreshGameInfo} />
                      </Provider>
                    </div>
                  </PopoverPanel>
                </>
              )}
            </Popover>

            <IconBar
              buttonType="icon"
              className="btngroup-game-list"
              clickAnywhere={true}
              collapse={false}
              filter={this.priorityButtons}
              group={`game-${type}-buttons`}
              instanceId={game.id}
              showAll={true}
              staticElements={[]}
              t={t}
              onAction={this.reportLeadAction}
            />
          </Media.Right>
        </Media>
      </ListGroupItem>
    );
  }

  private openLocation = () => {
    const { discovery } = this.props;
    window.api.shell.openFile(discovery.path);
  };

  // Click capture, because the list layout's add button sits inside IconBar, whose
  // actions don't take a click context: any click on an unadded row records the row's
  // list, and only the add the emit is keyed to ends up read.
  private tagOrigin = () => {
    const { detectedStore, discovery, game, source } = this.props;
    if (source === undefined) {
      return;
    }
    const { dispatch } = this.context.api.store;
    // Every click starts a new pick, so an earlier tile's store or extension isn't used for this one
    dispatch(clearGameAddStore());
    dispatch(setGameAddOrigin(game.id, source));
    dispatch(setGameAddExtension(game.extension ?? null));
    // Discovery's store wins, as on the tile: it's the copy Vortex will manage.
    const store = discovery?.store ?? detectedStore;
    if (source === "detected_list" && store !== undefined) {
      dispatch(setGameAddStore(VortexGameId(game.id), store));
    }
  };

  // The row's first button is what a tile leads with, so it reports under the same
  // name; any after it, which a tile files in its menu, and the popover's buttons are
  // named by their registered title.
  private reportLeadAction = (action: IActionDefinition, index: number) =>
    this.reportAction(
      "primary",
      index === 0 ? PRIMARY_ACTION_BY_SECTION[this.props.section] : action.title,
    );

  private reportMenuAction = (action: IActionDefinition) => this.reportAction("menu", action.title);

  // Click capture, because Hide is a registered component (HideGameIcon), whose click
  // never reaches onAction. Named as a tile's menu names it, by what it's about to do.
  private reportHideToggle = (event: React.MouseEvent) => {
    const { discovery, game } = this.props;
    if ((event.target as Element).closest(`#hide-${CSS.escape(game.id)}`) !== null) {
      this.reportAction("menu", discovery?.hidden ? "show" : "hide");
    }
  };

  private reportAction(placement: TileActionPlacement, action: string) {
    const { detectedStore, discovery, game, section } = this.props;
    createGamesPageTracker(this.context.api).trackTileAction({
      section,
      layout: "list",
      placement,
      action,
      game_id: numericNexusGameId(game.id),
      // Discovery's store wins, as on the tile: it's the copy Vortex will manage.
      game_store: discovery?.store ?? detectedStore ?? null,
    });
  }

  private changeLocation = () => {
    this.props.onBrowseGameLocation(this.props.game.id);
  };

  private priorityButtons = (action: IActionDefinition) => action.position < 100;

  private lowPriorityButtons = (action: IActionDefinition) => action.position >= 100;
}

export default GameRow as React.ComponentClass<IProps>;
