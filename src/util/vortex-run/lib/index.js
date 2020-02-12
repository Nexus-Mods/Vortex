"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const elevated_1 = __importDefault(require("./elevated"));
exports.runElevated = elevated_1.default;
const thread_1 = __importDefault(require("./thread"));
exports.runThreaded = thread_1.default;
const dynreq = require;
exports.dynreq = dynreq;
