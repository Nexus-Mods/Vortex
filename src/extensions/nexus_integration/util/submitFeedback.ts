import * as fs from "../../../renderer/util/fs";

import type { IFeedbackResponse } from "@nexusmods/nexus-api";
import type NexusT from "@nexusmods/nexus-api";
import PromiseBB from "bluebird";
import type ZipT from "node-7z";
import { tmpName } from "tmp";

function zipFiles(files: string[]): PromiseBB<string> {
  if (files.length === 0) {
    return PromiseBB.resolve(undefined);
  }
  const Zip: typeof ZipT = require("node-7z");
  const task: ZipT = new Zip();

  return new PromiseBB<string>((resolve, reject) => {
    tmpName(
      {
        postfix: ".7z",
      },
      (err, tmpPath: string) => (err !== null ? reject(err) : resolve(tmpPath)),
    );
  }).then((tmpPath) =>
    task.add(tmpPath, files, { ssw: true }).then(() => tmpPath),
  );
}

function submitFeedback(
  nexus: NexusT,
  title: string,
  message: string,
  feedbackFiles: string[],
  anonymous: boolean,
  hash: string,
): PromiseBB<IFeedbackResponse> {
  let archive: string;
  return zipFiles(feedbackFiles)
    .then((tmpPath) => {
      archive = tmpPath;
      return nexus.sendFeedback(title, message, tmpPath, anonymous, hash);
    })
    .finally(() => {
      if (archive !== undefined) {
        fs.removeAsync(archive);
      }
    });
}

export default submitFeedback;
