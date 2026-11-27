import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";

import { useMainContext } from "@/contexts";
import { purgesRunning } from "@/extensions/mod_management/selectors";
import { useSwitchingProfile } from "@/hooks/useSwitchingProfile";
import { activeGameId } from "@/util/selectors";
import { useSpineContext } from "@/views/components/Spine/SpineContext";

/**
 * Notifies about purges the menu's Apply button isn't showing. The button shows the active
 * game's purge, but only while the menu shows that game: not on a global page such as Settings,
 * not on the profile switcher, and never for another game's purge. Those get the "Purging"
 * notification instead, for as long as the button can't show them.
 */
export const PurgeNotifications = () => {
  const { api } = useMainContext();
  const { selection } = useSpineContext();
  const switchingProfile = useSwitchingProfile();
  const purges = useSelector(purgesRunning);
  const gameId = useSelector(activeGameId);
  const notified = useRef(new Set<string>());

  // A game selection is always the active game.
  const gameOnApply = !switchingProfile && selection.type === "game" ? gameId : undefined;

  useEffect(() => {
    const unseen = Object.entries(purges).filter(([, purge]) => purge.gameId !== gameOnApply);

    for (const [purgeId, purge] of unseen) {
      api.sendNotification({
        id: purgeId,
        type: "activity",
        title: "Purging",
        message: purge.text,
        progress: purge.percent,
      });
    }

    const stillUnseen = new Set(unseen.map(([purgeId]) => purgeId));
    for (const purgeId of notified.current) {
      if (!stillUnseen.has(purgeId)) {
        api.dismissNotification(purgeId);
      }
    }
    notified.current = stillUnseen;
  }, [api, purges, gameOnApply]);

  useEffect(
    () => () => {
      for (const purgeId of notified.current) {
        api.dismissNotification(purgeId);
      }
    },
    [api],
  );

  return null;
};
