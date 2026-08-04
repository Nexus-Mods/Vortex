import "i18next";
import type Resources from "./util/i18n.resources";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: Resources;
  }
}
