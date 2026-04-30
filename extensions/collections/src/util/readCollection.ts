import { fs, types } from "vortex-api";
import { ICollection } from "../types/ICollection";
import { validateICollection } from "../validationCode/validation";
import { postProcessRule } from "./postProcessRule";

function validationMessage(msg: any): string {
  return `${msg.instancePath || "/"} ${msg.message}`;
}

export async function readCollection(
  api: types.IExtensionApi,
  manifest: string,
): Promise<ICollection> {
  const collectionData = await fs.readFileAsync(manifest, {
    encoding: "utf-8",
  });
  const collection: ICollection = JSON.parse(collectionData);
  const readErrors = validateICollection(collection);
  if (readErrors.length > 0) {
    api.showErrorNotification(
      "Collection validation mismatch",
      "There was a validation issue with this collection. " +
        "During the testing phase, this is likely caused by the checks being too strict and " +
        "the collection itself should still work correctly.\n" +
        "To help us improve the validation, please report this error once on each " +
        "collection it appears for.\n\n" +
        readErrors.map(validationMessage).join("\n"),
    );
    /*
    throw new util.ProcessCanceled(
      'Collection invalid:\n' + ,
      readErrors.map(validationMessage));
    */
  }
  collection.modRules = (collection.modRules ?? []).map((rule) =>
    postProcessRule(rule),
  );

  return collection;
}
