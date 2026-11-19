import { createAction } from "redux-act";

export const showURL = createAction(
  "SHOW_URL",
  (url: string, instructions: string, subscriber: string, skippable: boolean) => ({
    url,
    instructions,
    subscriber,
    skippable: skippable ?? false,
  }),
);

export const closeBrowser = createAction("CLOSE_BROWSER");
