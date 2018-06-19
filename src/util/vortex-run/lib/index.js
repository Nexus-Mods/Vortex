"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const elevated_1 = require("./elevated");
exports.runElevated = elevated_1.default;
exports.Win32Error = elevated_1.Win32Error;
const thread_1 = require("./thread");
exports.runThreaded = thread_1.default;
const dynreq = require;
exports.dynreq = dynreq;
