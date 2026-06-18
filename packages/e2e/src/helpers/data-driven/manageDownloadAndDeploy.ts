/**
 * Playwright registration for one `manage-download-and-deploy` YAML E2E case.
 */
import type {
  DynamicExtensionId,
  DynamicGameExtensionId,
} from "../../fixtures/extensions/dynamic-extension";
import { test } from "../../fixtures/vortex-app";
import { deployAndExpectFiles, installModManagerDownload } from "../modManagerDownload";
import { Timeouts } from "../timeouts";
import {
  compileRegexMatcher,
  compileTextMatcher,
  expandDataDrivenCase,
  nexusUserForName,
  variantTitle,
  type ManageDownloadAndDeployTestCase,
} from "./testCases";

/**
 * Registers one `manage-download-and-deploy` YAML case as Playwright test variants.
 *
 * @param testCase Validated YAML case to register.
 * @returns Nothing; variants are registered with Playwright during module load.
 * @throws Error when a case uses an invalid RegExp matcher in `download.expectedModRow` or `download.expectedUrl`.
 * @throws Error when a case defines duplicate `matrix.nexusUser` entries.
 */
export function registerManageDownloadAndDeployCase(
  testCase: ManageDownloadAndDeployTestCase,
): void {
  const expectedModRow = compileTextMatcher(
    testCase.download.expectedModRow,
    testCase.sourcePath,
    "download.expectedModRow",
  );
  const expectedUrl =
    testCase.download.expectedUrl === undefined
      ? undefined
      : compileRegexMatcher(
          testCase.download.expectedUrl,
          testCase.sourcePath,
          "download.expectedUrl",
        );
  const deploy = testCase.deploy;

  test.describe(testCase.suite, () => {
    for (const variant of expandDataDrivenCase(testCase)) {
      registerManageDownloadAndDeployVariant({
        deploy,
        expectedModRow,
        expectedUrl,
        testCase,
        variant,
      });
    }
  });
}

interface ManageDownloadAndDeployVariantRegistration {
  deploy: ManageDownloadAndDeployTestCase["deploy"];
  expectedModRow: string | RegExp;
  expectedUrl: RegExp | undefined;
  testCase: ManageDownloadAndDeployTestCase;
  variant: ReturnType<typeof expandDataDrivenCase>[number];
}

function registerManageDownloadAndDeployVariant(
  registration: ManageDownloadAndDeployVariantRegistration,
): void {
  const { deploy, expectedModRow, expectedUrl, testCase, variant } = registration;

  test.describe(`${testCase.gameId} / ${variant.nexusUser}`, () => {
    test.use({
      dynamicExtensionIds: variant.resolvedFixtures.dynamicExtensionIds as DynamicExtensionId[],
      dynamicGameExtensionId:
        (variant.resolvedFixtures.dynamicGameExtensionId as DynamicGameExtensionId | undefined) ??
        null,
      managedGameId: variant.resolvedFixtures.managedGameId,
      nexusUser: nexusUserForName(variant.nexusUser),
    });

    test(variantTitle(variant), async ({ vortexApp, vortexWindow, managedGame, nexusPage }) => {
      await test.step("Install mod from Nexus via Mod Manager Download", async () => {
        await installModManagerDownload({
          expectedModRow,
          expectedUrl,
          missingNxmMessage: testCase.download.missingNxmMessage,
          modUrl: testCase.download.modUrl,
          nexusPage,
          timeoutMs: Timeouts.NETWORK,
          vortexApp,
          vortexWindow,
        });
      });

      if (deploy !== undefined) {
        await test.step("Deploy mod and verify expected files", async () => {
          await deployAndExpectFiles(vortexWindow, managedGame.gamePath, deploy.expectedFiles, {
            message: deploy.message,
            timeoutMs: Timeouts.NETWORK,
          });
        });
      }
    });
  });
}
