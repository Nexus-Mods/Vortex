import type PromiseBB from "bluebird";
import type { TFunction } from "i18next";

import * as path from "path";
import * as React from "react";
import { ListGroupItem, Media, Popover } from "react-bootstrap";
import { Provider } from "react-redux";
import { pathToFileURL } from "url";

import type { IActionDefinition } from "../../../types/IActionDefinition";
import type { IMod } from "../../mod_management/types/IMod";
import type { IDiscoveryResult } from "../types/IDiscoveryResult";
import type { IGameStored } from "../types/IGameStored";

import { nexusGames } from "../../../extensions/nexus_integration/util";
import { nexusGameId } from "../../../extensions/nexus_integration/util/convertGameId";
import { ComponentEx } from "../../../controls/ComponentEx";
import IconBar from "../../../controls/IconBar";
import OverlayTrigger from "../../../controls/OverlayTrigger";
import { IconButton } from "../../../controls/TooltipControls";
import opn from "../../../util/opn";
import GameInfoPopover from "./GameInfoPopover";

export interface IProps {
  t: TFunction;
  game: IGameStored;
  discovery?: IDiscoveryResult;
  mods?: { [modId: string]: IMod };
  active: boolean;
  type: string;
  getBounds: () => ClientRect;
  container: HTMLElement;
  onRefreshGameInfo: (gameId: string) => PromiseBB<void>;
  onBrowseGameLocation: (gameId: string) => PromiseBB<void>;
}

/**
 * thumbnail + controls for a single game mode within the game picker
 *
 * @class GameThumbnail
 */
class GameRow extends ComponentEx<IProps, {}> {
  private mRef = null;

  public render(): JSX.Element {
    const {
      t,
      active,
      container,
      discovery,
      game,
      getBounds,
      onRefreshGameInfo,
      type,
    } = this.props;

    if (game === undefined) {
      return null;
    }

    let logoPath: string | undefined =
      game.extensionPath !== undefined && game.logo !== undefined
        ? path.join(game.extensionPath, game.logo)
        : game.imageURL;

    // For adaptor-registered games (no local logo), resolve a Nexus thumbnail
    if (logoPath == null) {
      const domain = nexusGameId(game);
      const numericId = domain != null
        ? nexusGames().find((g) => g.domain_name === domain)?.id
        : undefined;
      if (numericId !== undefined) {
        logoPath = `https://images.nexusmods.com/images/games/v2/${numericId}/thumbnail.jpg`;
      }
    }

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

    let imgurl = null;
    if (logoPath != null) {
      let protocol = null;
      try {
        protocol = new URL(logoPath)?.protocol;
      } catch {
        // not a URL, treat as file path
      }
      imgurl =
        protocol != null && protocol.startsWith("http")
          ? logoPath
          : pathToFileURL(logoPath).href;
    }

    return (
      <ListGroupItem className={classes.join(" ")}>
        <Media>
          <Media.Left>
            <div className="game-thumbnail-container-list">
              <img className="game-thumbnail-img-list" src={imgurl} />
            </div>
          </Media.Left>

          <Media.Body>
            <Media.Heading>{t(game.name.replace(/\t/g, " "))}</Media.Heading>

            {location !== null ? (
              <p>
                {t("Location")}: {location}
              </p>
            ) : null}
          </Media.Body>

          <Media.Right>
            <OverlayTrigger
              container={container}
              getBounds={getBounds}
              orientation="horizontal"
              overlay={gameInfoPopover}
              rootClose={true}
              shouldUpdatePosition={true}
              trigger="click"
              triggerRef={this.setRef}
            >
              <IconButton
                className="btn-embed"
                icon="game-menu"
                id={`btn-info-${game.id}`}
                tooltip={t("Show Details")}
              />
            </OverlayTrigger>

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
            />
          </Media.Right>
        </Media>
      </ListGroupItem>
    );
  }

  private setRef = (ref) => {
    this.mRef = ref;
  };

  private redraw = () => {
    if (this.mRef !== null) {
      this.mRef.hide();
      setTimeout(() => {
        if (this.mRef !== null) {
          this.mRef.show();
        }
      }, 100);
    }
  };

  private openLocation = () => {
    const { discovery } = this.props;
    opn(discovery.path).catch(() => null);
  };

  private changeLocation = () => {
    this.props.onBrowseGameLocation(this.props.game.id);
  };

  private priorityButtons = (action: IActionDefinition) =>
    action.position < 100;

  private lowPriorityButtons = (action: IActionDefinition) =>
    action.position >= 100;
}

export default GameRow as React.ComponentClass<IProps>;
