import Bluebird from "bluebird";
import type {
  IExtensionApi,
  IExtensionContext,
  IPreviewFile,
} from "../../types/IExtensionContext";
import { ProcessCanceled, UserCanceled } from "../../util/CustomErrors";
import { log } from "../../util/log";
import opn from "../../util/opn";
import { getErrorMessageOrDefault } from "@vortex/shared";

interface IPreviewHandler {
  priority: number;
  handler: (
    files: IPreviewFile[],
    allowPick: boolean,
  ) => Bluebird<IPreviewFile>;
}

let previewHandlers: IPreviewHandler[] = [];

async function fallbackHandler(
  api: IExtensionApi,
  files: IPreviewFile[],
): Promise<IPreviewFile> {
  const result = await api.showDialog(
    "info",
    "Select files to open",
    {
      text:
        "The files you select below will be opened with whatever application " +
        "is set up in your operating system to handle it, if any.",
      checkboxes: files.map((file, idx) => ({
        id: file.filePath,
        text: file.label,
        value: idx === 0,
      })),
    },
    [{ label: "Cancel" }, { label: "Open" }],
  );

  if (result.action === "Cancel") {
    throw new UserCanceled();
  }

  Object.keys(result.input).forEach((key) => {
    if (result.input[key]) {
      opn(key).catch((err) => null);
    }
  });

  return null;
}

function init(context: IExtensionContext) {
  context.registerPreview = (
    priority: number,
    handler: (
      files: IPreviewFile[],
      allowPick: boolean,
    ) => Bluebird<IPreviewFile>,
  ) => {
    previewHandlers.push({ priority, handler });
    previewHandlers = previewHandlers.sort(
      (lhs, rhs) => lhs.priority - rhs.priority,
    );
  };

  context.registerPreview(300, (files: IPreviewFile[], allowPick: boolean) =>
    Bluebird.resolve(fallbackHandler(context.api, files)),
  );

  context.once(() => {
    const { api } = context;
    api.events.on(
      "preview-files",
      async (files: IPreviewFile[], cb?: (selection: IPreviewFile) => void) => {
        for (const handler of previewHandlers) {
          try {
            const res = await handler.handler(files, cb !== undefined);
            if (cb !== undefined) {
              cb(res);
            }
            return;
          } catch (err) {
            if (err instanceof ProcessCanceled) {
              // nop, assume the file type not supported
            } else if (err instanceof UserCanceled) {
              // user canceled. As far as the callback is concerned this is
              // the same outcome as if the handler hadn't supported picking
              // in the first place
              if (cb !== undefined) {
                cb(null);
              }
              return;
            } else {
              log(
                "error",
                "file preview handler failed",
                getErrorMessageOrDefault(err),
              );
            }
          }
        }

        api
          .showDialog(
            "info",
            "Preview not supported",
            {
              text:
                "Sorry, preview for this file type is not supported. " +
                "You should check the extensions panel if there is one that " +
                "supports it.",
            },
            [{ label: "Continue" }],
          )
          .then(() => {
            if (cb !== undefined) {
              cb(null);
            }
          });
      },
    );
  });
}

export default init;
