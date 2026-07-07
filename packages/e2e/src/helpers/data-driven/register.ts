/* eslint-disable perfectionist/sort-imports */
/**
 * Flow dispatcher for YAML-backed E2E test cases.
 */
import { test } from "../../fixtures/vortex-app";
import { registerManageDownloadAndDeployCase } from "./manageDownloadAndDeploy";
import type { DataDrivenFlow, DataDrivenTestCase } from "./testCases";

/**
 * Registers YAML-backed E2E cases by dispatching each case to its flow registrar.
 *
 * @param cases Validated YAML cases to register.
 * @returns Nothing; cases are registered with Playwright during module load.
 * @throws Error when a flow registrar throws while compiling or registering a case.
 */
export function registerDataDrivenCases(cases: readonly DataDrivenTestCase[]): void {
  if (cases.length === 0) return;

  test.describe("Data-driven YAML cases", () => {
    for (const [flow, flowCases] of casesByFlow(cases)) {
      test.describe(flow, () => {
        for (const testCase of flowCases) {
          registerDataDrivenCase(testCase);
        }
      });
    }
  });
}

function registerDataDrivenCase(testCase: DataDrivenTestCase): void {
  switch (testCase.flow) {
    case "manage-download-and-deploy":
      registerManageDownloadAndDeployCase(testCase);
      return;
  }
}

function casesByFlow(
  cases: readonly DataDrivenTestCase[],
): Map<DataDrivenFlow, DataDrivenTestCase[]> {
  const groupedCases = new Map<DataDrivenFlow, DataDrivenTestCase[]>();

  for (const testCase of cases) {
    const flowCases = groupedCases.get(testCase.flow) ?? [];
    flowCases.push(testCase);
    groupedCases.set(testCase.flow, flowCases);
  }

  return groupedCases;
}
