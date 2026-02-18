// top-level file for the 'api' which exposes components
// that should be available to extensions

import PromiseBB from "bluebird";

import * as actions from "./actions/index";
import * as types from "./types/api";
import * as util from "./util/api";
import * as fs from "./util/fs";
import { log } from "./util/log";
import * as selectors from "./util/selectors";

export * from "./controls/api";
export { ComponentEx, PureComponentEx } from "./controls/ComponentEx";
// TODO: don't re-export bluebird Promis as "Promise", that's fucking insidious
export { actions, PromiseBB as Promise, fs, log, selectors, types, util };
// Tailwind component library (namespaced to avoid conflicts)
export { Tailwind } from "./tailwind";

export * from "./views/api";
