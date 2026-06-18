/**
 * Registers YAML-backed E2E cases as individual Playwright tests.
 */
import { registerDataDrivenCases } from "../helpers/data-driven/register";
import { loadDataDrivenTestCases } from "../helpers/data-driven/testCases";

registerDataDrivenCases(loadDataDrivenTestCases());
