// top-level file for the 'api' which exposes components
// that should be available to extensions

import * as actions from "./actions/index";
import * as types from "./renderer/types/api";
import * as util from "./util/api";
import * as fs from "./util/fs";
import { log } from "./util/log";
import * as selectors from "./util/selectors";

import PromiseBB from "bluebird";

export * from "./renderer/controls/api";
export * from "./renderer/views/api";
// TODO: don't re-export bluebird Promis as "Promise", that's fucking insidious
export { actions, PromiseBB as Promise, fs, log, selectors, types, util };
export { ComponentEx, PureComponentEx } from "./renderer/controls/ComponentEx";

// Tailwind component library (namespaced to avoid conflicts)
export { Tailwind } from "./renderer/tailwind";
