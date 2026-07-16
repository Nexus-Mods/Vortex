import * as path from "path";
import * as url from "url";

import type PromiseBB from "bluebird";
import type { TFunction } from "i18next";
import * as React from "react";
import { Button, Panel, Popover } from "react-bootstrap";
import { Provider } from "react-redux";

import { connect, PureComponentEx } from "@/controls/ComponentEx";
import Icon from "@/controls/Icon";
import IconBar from "@/controls/IconBar";
import OverlayTrigger from "@/controls/OverlayTrigger";
import { IconButton } from "@/controls/TooltipControls";
import { gameTileImageURL } from "@/extensions/nexus_integration/util/gameTileImageURL";
import type { IActionDefinition } from "@/types/api";
import type { IMod, IProfile, IState } from "@/types/IState";
import { Image } from "@/ui/components/image/Image";
import { joinClasses } from "@/ui/utils/joinClasses";
import { getSafe } from "@/util/storeHelper";
import { countIf } from "@/util/util";

import type { IGameStored } from "../types/IGameStored";
import ActiveModCount from "./ActiveModCount";
import GameInfoPopover from "./GameInfoPopover";
import GameName from "./GameName";

export interface IBaseProps {
  t: TFunction;
  game: IGameStored;
  active: boolean;
  discovered?: boolean;
  onRefreshGameInfo?: (gameId: string) => PromiseBB<void>;
  type: string;
  getBounds?: () => ClientRect;
  container?: HTMLElement;
  onLaunch?: () => void;
  // artwork-only tile for tight spots like the Recently Managed dashlet:
  // hides the name (exposed as a tooltip on the tile instead) and reduces
  // the mod counter to icon and count
  compact?: boolean;
  /** Extra classes for the tile root (e.g. grid-specific sizing). */
  className?: string;
  /** Extra classes for the inner Image wrapper (e.g. border radius). */
  imageClassName?: string;
}

interface IConnectedProps {
  profile: IProfile;
  mods: { [modId: string]: IMod };
}

type IProps = IBaseProps & IConnectedProps;

/**
 * thumbnail + controls for a single game mode within the game picker
 *
 * @class GameThumbnail
 */
class GameThumbnail extends PureComponentEx<IProps, {}> {
  private mRef = null;

  public render(): JSX.Element {
    const { t, active, className, compact, discovered, game, imageClassName, mods, profile, type } =
      this.props;

    if (game === undefined) {
      return null;
    }

    // Prefer the Nexus "tile" art so it matches the website. Fall back to a
    // local extension logo / imageURL when no Nexus tile can be resolved.
    let logoPath: string | undefined = gameTileImageURL(game);
    if (logoPath == null) {
      logoPath =
        game.extensionPath !== undefined && game.logo !== undefined
          ? path.join(game.extensionPath, game.logo)
          : game.imageURL;
    }

    // Mod count should only be shown for Managed and Discovered games as
    //  the supported type suggests that the game has been removed from the machine.
    const modCount =
      profile !== undefined && type !== "undiscovered"
        ? countIf(
            Object.keys(profile.modState || {}),
            (id) => profile.modState[id].enabled && mods[id] !== undefined,
          )
        : undefined;

    const classes = [
      "game-thumbnail",
      `game-thumbnail-${discovered !== false ? "discovered" : "undiscovered"}`,
    ];

    let imgurl = null;
    if (logoPath != null) {
      let protocol = null;
      try {
        const parsedUrl = new URL(logoPath);
        protocol = parsedUrl.protocol;
      } catch (err) {
        // If URL parsing fails, treat as file path
      }
      imgurl =
        protocol !== null && protocol.startsWith("http")
          ? logoPath
          : url.pathToFileURL(logoPath).href;
    }

    return (
      <Panel
        bsStyle={active ? "primary" : "default"}
        className={joinClasses([...classes, className])}
        title={compact ? game.name.replace(/\t/g, " ") : undefined}
      >
        <Panel.Body className="game-thumbnail-body">
          <Image
            alt={game.name}
            className={joinClasses(["w-full", imageClassName])}
            decoding="async"
            fit="cover"
            imageType="game"
            loading="lazy"
            src={imgurl}
          >
            <div className="bottom">
              <GameName compact={compact} name={game.name} />

              <ActiveModCount compact={compact} count={modCount} t={t} />
            </div>

            <div className="hover-menu">
              {type === "launcher" ? this.renderLaunch() : this.renderMenu()}
            </div>

            {type !== "launcher" ? (
              game.contributed ? (
                <div
                  className="game-thumbnail-tags"
                  title={
                    game.contributed
                      ? t("Contributed by {{name}}", {
                          replace: { name: game.contributed },
                        })
                      : null
                  }
                >
                  {game.contributed ? "Community" : null}
                </div>
              ) : null
            ) : null}
          </Image>
        </Panel.Body>
      </Panel>
    );
  }

  private renderLaunch(): JSX.Element {
    const { onLaunch } = this.props;
    return (
      <div className="hover-content hover-launcher">
        <Button className="btn-embed" style={{ width: "100%", height: "100%" }} onClick={onLaunch}>
          <Icon name="launch-application" />
        </Button>
      </div>
    );
  }

  private renderMenu(): JSX.Element[] {
    const { t, container, game, getBounds, onRefreshGameInfo, type } = this.props;
    const gameInfoPopover = (
      <Popover className="popover-game-info" id={`popover-info-${game.id}`}>
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
          />

          <GameInfoPopover
            game={game}
            t={t}
            onChange={this.redraw}
            onRefreshGameInfo={onRefreshGameInfo}
          />
        </Provider>
      </Popover>
    );

    return [
      <div className="hover-content" key="primary-buttons">
        <IconBar
          buttonType="text"
          className="buttons"
          clickAnywhere={true}
          collapse={false}
          filter={this.priorityButtons}
          group={`game-${type}-buttons`}
          id={`game-thumbnail-${game.id}`}
          instanceId={game.id}
          orientation="vertical"
          staticElements={[]}
          t={t}
        />
      </div>,
      <OverlayTrigger
        container={container}
        getBounds={getBounds || this.getWindowBounds}
        key="info-overlay"
        orientation="horizontal"
        overlay={gameInfoPopover}
        rootClose={true}
        shouldUpdatePosition={true}
        trigger="click"
        triggerRef={this.setRef}
      >
        <IconButton
          className="game-thumbnail-info btn-embed"
          icon="game-menu"
          id={`btn-info-${game.id}`}
          tooltip={t("Show Details")}
        />
      </OverlayTrigger>,
    ];
  }

  private priorityButtons = (action: IActionDefinition) => action.position < 100;

  private lowPriorityButtons = (action: IActionDefinition) => action.position >= 100;

  private getWindowBounds = (): DOMRect => {
    return {
      top: 0,
      left: 0,
      height: window.innerHeight,
      width: window.innerWidth,
      bottom: window.innerHeight,
      right: window.innerWidth,
    } as any;
  };

  private setRef = (ref) => {
    this.mRef = ref;
  };

  private redraw = () => {
    if (this.mRef !== null) {
      this.mRef.forceUpdate();
    }
  };
}

const emptyObj = {};

function mapStateToProps(state: IState, ownProps: IBaseProps): IConnectedProps {
  const profiles = state.persistent.profiles;

  const lastActiveProfile =
    ownProps.game !== undefined
      ? getSafe(state.settings.profiles, ["lastActiveProfile", ownProps.game.id], undefined)
      : undefined;

  const profile = lastActiveProfile !== undefined ? profiles[lastActiveProfile] : undefined;

  return {
    profile,
    mods: (profile !== undefined ? state.persistent.mods[profile.gameId] : emptyObj) || emptyObj,
  };
}

export default connect(mapStateToProps)(GameThumbnail);
