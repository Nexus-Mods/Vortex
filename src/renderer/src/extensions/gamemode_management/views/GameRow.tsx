import type { TFunction } from "i18next";
import * as React from "react";
import { ListGroupItem, Media } from "react-bootstrap";
import { Provider } from "react-redux";

import Icon from "@/controls/Icon";
import { Image } from "@/ui/components/image/Image";
import { Popover } from "@/ui/components/popover/Popover";
import { PopoverButton } from "@/ui/components/popover/PopoverButton";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";

import { ComponentEx } from "../../../controls/ComponentEx";
import IconBar from "../../../controls/IconBar";
import type { IActionDefinition } from "../../../types/IActionDefinition";
import opn from "../../../util/opn";
import type { IMod } from "../../mod_management/types/IMod";
import type { IDiscoveryResult } from "../types/IDiscoveryResult";
import type { IGameStored } from "../types/IGameStored";
import { gameArtURL } from "../util/gameArtURL";
import GameInfoPopover from "./GameInfoPopover";

export interface IProps {
  t: TFunction;
  game: IGameStored;
  discovery?: IDiscoveryResult;
  mods?: { [modId: string]: IMod };
  active: boolean;
  type: string;
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
      <ListGroupItem className={classes.join(" ")}>
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
                    <div className="popover-content">
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
            />
          </Media.Right>
        </Media>
      </ListGroupItem>
    );
  }

  private openLocation = () => {
    const { discovery } = this.props;
    opn(discovery.path).catch(() => null);
  };

  private changeLocation = () => {
    this.props.onBrowseGameLocation(this.props.game.id);
  };

  private priorityButtons = (action: IActionDefinition) => action.position < 100;

  private lowPriorityButtons = (action: IActionDefinition) => action.position >= 100;
}

export default GameRow as React.ComponentClass<IProps>;
