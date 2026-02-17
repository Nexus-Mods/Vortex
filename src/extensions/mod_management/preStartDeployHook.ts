import type {
  IExtensionApi,
  IRunParameters,
} from "../../renderer/types/IExtensionContext";
import type { IState } from "../../renderer/types/IState";
import onceCB from "../../util/onceCB";

import { needToDeploy } from "./selectors";

import PromiseBB from "bluebird";
import getText from "./texts";
import { UserCanceled } from "../../util/CustomErrors";

type DeployResult = "auto" | "yes" | "skip" | "cancel";

function queryDeploy(api: IExtensionApi): PromiseBB<DeployResult> {
  const state: IState = api.store.getState();
  if (!needToDeploy(state)) {
    return PromiseBB.resolve<DeployResult>("auto");
  } else {
    const t = api.translate;
    return api
      .showDialog(
        "question",
        t("Pending deployment"),
        {
          bbcode: t(
            "Mod deployment {{more}} is pending.[br][/br]" +
              "This means that changes made to mods such as updating, " +
              "enabling/disabling, as well as newly set mod rules need to be deployed to take effect.[br][/br]" +
              "You can skip this step, ignoring (but not reverting) newly made changes to mods and mod rules, " +
              "or deploy now to commit the changes.",
            {
              replace: {
                more: `[More id='more-deploy' name='${t("Deployment")}']${getText("deployment", t)}[/More]`,
              },
            },
          ),
        },
        [{ label: "Cancel" }, { label: "Skip" }, { label: "Deploy" }],
      )
      .then((result) => {
        switch (result.action) {
          case "Skip":
            return PromiseBB.resolve<DeployResult>("skip");
          case "Deploy":
            return PromiseBB.resolve<DeployResult>("yes");
          default:
            return PromiseBB.resolve<DeployResult>("cancel");
        }
      });
  }
}

function checkDeploy(api: IExtensionApi): PromiseBB<void> {
  return queryDeploy(api).then((shouldDeploy) => {
    if (shouldDeploy === "yes") {
      return new PromiseBB<void>((resolve, reject) => {
        api.events.emit(
          "deploy-mods",
          onceCB((err) => {
            if (err !== null) {
              reject(err);
            } else {
              resolve();
            }
          }),
        );
      });
    } else if (shouldDeploy === "auto") {
      return new PromiseBB<void>((resolve, reject) => {
        api.events.emit("await-activation", (err: Error) => {
          if (err !== null) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    } else if (shouldDeploy === "cancel") {
      return PromiseBB.reject(new UserCanceled());
    } else {
      // skip
      return PromiseBB.resolve();
    }
  });
}

function preStartDeployHook(
  api: IExtensionApi,
  input: IRunParameters,
): PromiseBB<IRunParameters> {
  return input.options.suggestDeploy === true
    ? checkDeploy(api).then(() => input)
    : PromiseBB.resolve(input);
}

export default preStartDeployHook;
