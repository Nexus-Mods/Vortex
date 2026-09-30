import { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSettingsPage } from "@/actions";
import { useMainContext } from "@/contexts";
import type { IState } from "@/types/IState";
import { UserCanceled } from "@/util/CustomErrors";
import onceCB from "@/util/onceCB";
import * as selectors from "@/util/selectors";

import { getAllActivators } from "../util/deploymentMethods";
import { NoDeployment } from "../util/exceptions";

/** Tells the user no deployment method is set, and offers to take them there. */
export const useNoMethodWarning = () => {
  const { api } = useMainContext();
  const dispatch = useDispatch();

  return useCallback(() => {
    api.sendNotification({
      id: "select-deployment-method-first",
      type: "warning",
      message: "You have to select a deployment method first",
      actions: [
        {
          title: "Fix",
          action: (dismiss: () => void) => {
            api.events.emit("show-main-page", "application_settings");
            dispatch(setSettingsPage("Mods"));
            dismiss();
          },
        },
      ],
    });
  }, [api, dispatch]);
};

/** The deployment method the active game is set to use, if it resolves to one. */
export const useActivator = () => {
  const gameId = useSelector(selectors.activeGameId);
  const activatorId = useSelector((state: IState) => state.settings.mods.activator?.[gameId]);

  return useMemo(
    () =>
      activatorId === undefined
        ? undefined
        : getAllActivators().find((activator) => activator.id === activatorId),
    [activatorId],
  );
};

/**
 * Deploys the active profile's mods, as the menu's Apply button does. Warns instead when the game has no deployment method set.
 */
export const useDeployMods = (): {
  needToDeploy: boolean;
  /** Changes deploy on their own, so there's nothing for the user to apply. */
  autoDeploy: boolean;
  isDeploying: boolean;
  /** 0-100 while deploying; undefined otherwise. */
  deployProgress: number | undefined;
  /** What the deploy is doing, e.g. the mod it's on; undefined when idle. */
  deployStep: string | undefined;
  deploy: () => void;
} => {
  const { api } = useMainContext();
  const activator = useActivator();
  const needToDeploy = useSelector(selectors.needToDeploy);
  const autoDeploy = useSelector((state: IState) => state.settings.automation.deploy);

  // Auto deploy waits a moment before starting, so a pending one counts as deploying.
  const isDeploying = useSelector((state: IState) =>
    (state.session.base.activity?.mods ?? []).some((id) =>
      ["deployment", "deployment_pending"].includes(id),
    ),
  );
  const percent = useSelector(
    (state: IState) => state.session.base.progress?.mods?.deployment?.percent,
  );
  const step = useSelector((state: IState) => state.session.base.progress?.mods?.deployment?.text);
  const gameId = useSelector(selectors.activeGameId);
  const profileId = useSelector((state: IState) =>
    selectors.lastActiveProfileForGame(state, gameId),
  );
  const noMethod = useNoMethodWarning();

  const deploy = useCallback(() => {
    api.events.emit(
      "deploy-mods",
      onceCB((err: Error | null) => {
        if (err === null) {
          api.sendNotification({
            id: "mods-deployed",
            type: "info",
            message: "Mods deployed",
            displayMS: 3000,
          });
          return;
        }

        if (err instanceof UserCanceled) {
          return;
        }

        if (err instanceof NoDeployment) {
          api.showErrorNotification(
            "You need to select a deployment method in settings",
            undefined,
            { allowReport: false },
          );
          return;
        }

        api.showErrorNotification("Failed to activate mods", err);
      }),
      profileId,
      undefined,
      { manual: true },
    );
  }, [api, profileId]);

  return {
    needToDeploy,
    autoDeploy,
    isDeploying,
    deployProgress: isDeploying ? (percent ?? 0) : undefined,
    deployStep: isDeploying ? step || undefined : undefined,
    deploy: activator !== undefined ? deploy : noMethod,
  };
};
