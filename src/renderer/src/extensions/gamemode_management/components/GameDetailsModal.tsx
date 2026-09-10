import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { IGameInfoEntry, IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { Modal } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";
import { TypographyLink } from "@/ui/components/typography/TypographyLink";
import { bytesToString } from "@/util/util";

export interface IGameDetailsModalProps {
  gameId: string;
  gameName: string;
  isOpen: boolean;
  onClose: () => void;
  onRefreshGameInfo?: (gameId: string) => PromiseLike<void>;
}

/**
 * Which copy of the game this is leads the rows: everything under it — the path, the
 * version, the sizes — describes that one install. Every other row keeps the priority
 * its provider registered with.
 */
const STORE_KEY = "store";

const rowPriority = (entry: IGameInfoEntry, key: string) =>
  key === STORE_KEY ? Number.NEGATIVE_INFINITY : (entry.priority ?? 100);

/**
 * A provider answers with whatever it has, typed only by the `type` it declares
 * alongside, so every value arrives as `any` and is read here through that declaration.
 * Module scope, so the date isn't built during a render.
 */
const formatValue = (value: unknown, type: string | undefined, language: string): string => {
  if (type === "date") {
    return new Date(value as string | number).toLocaleString(language);
  }

  if (type === "bytes") {
    return bytesToString(Number(value));
  }

  if (typeof value === "string") {
    return value;
  }

  return typeof value === "number" ? value.toString() : (JSON.stringify(value) ?? "");
};

const InfoValue = ({ entry, language }: { entry: IGameInfoEntry; language: string }) => {
  const value = formatValue(entry.value, entry.type, language);

  if (entry.type === "url") {
    return (
      <TypographyLink
        appearance="subdued"
        className="wrap-anywhere"
        typographyType="inherit"
        onClick={() => window.api.shell.openUrl(value)}
      >
        {value}
      </TypographyLink>
    );
  }

  return <span className="wrap-anywhere">{value}</span>;
};

/**
 * What a game's info providers know about it, as a dialog off the tile's menu.
 *
 * The providers answer at their own pace, so the rows are whatever has arrived: asking
 * again on open is what keeps a path the user has just changed from showing stale.
 */
export const GameDetailsModal = ({
  gameId,
  gameName,
  isOpen,
  onClose,
  onRefreshGameInfo,
}: IGameDetailsModalProps) => {
  const { t } = useTranslation();

  const gameInfo = useSelector(
    (state: IState) => state.persistent.gameMode.gameInfo?.[gameId] ?? {},
  );
  const language = useSelector((state: IState) => state.settings.interface.language);
  const discoveredPath = useSelector(
    (state: IState) => state.settings.gameMode.discovered[gameId]?.path,
  );

  useEffect(() => {
    if (isOpen) {
      onRefreshGameInfo?.(gameId);
    }
  }, [discoveredPath, gameId, isOpen, onRefreshGameInfo]);

  const keys = Object.keys(gameInfo)
    .filter((key) => !!gameInfo[key].value)
    .sort((lhs, rhs) => rowPriority(gameInfo[lhs], lhs) - rowPriority(gameInfo[rhs], rhs));

  return (
    <Modal isOpen={isOpen} size="sm" title={t("Game details")} onClose={onClose}>
      <div className="space-y-2">
        <Typography appearance="subdued" className="font-semibold" typographyType="body-sm">
          {gameName}
        </Typography>

        <Typography appearance="subdued" className="space-y-2" typographyType="body-sm">
          {!keys.length
            ? t("No information about this game")
            : keys.map((key) => (
                <p key={key}>
                  <span className="wrap-normal">{`${t(gameInfo[key].title)}: `}</span>

                  <InfoValue entry={gameInfo[key]} language={language} />
                </p>
              ))}
        </Typography>
      </div>

      <Button appearance="moderate" brand="neutral" className="mt-4 w-full" onClick={onClose}>
        {t("Close")}
      </Button>
    </Modal>
  );
};
