/**
 * Playwright registration for one `manage-download-and-deploy` YAML E2E case.
 */
import type {
  DynamicExtensionId,
  DynamicGameExtensionId,
} from "../../fixtures/extensions/dynamic-extension";
import type { MockTreePlatform } from "../../fixtures/game-setup/mock-tree";
import { test } from "../../fixtures/vortex-app";
import { deployAndExpectFiles, installModManagerDownload } from "../modManagerDownload";
import { Timeouts } from "../timeouts";
import {
  compileRegexMatcher,
  compileTextMatcher,
  expandDataDrivenCase,
  nexusUserForName,
  resolveExpectedFiles,
  variantTitle,
  type ManageDownloadAndDeployTestCase,
} from "./testCases";

/**
 * Registers one `manage-download-and-deploy` YAML case as Playwright test variants.
 *
 * @param testCase Validated YAML case to register.
 * @returns Nothing; variants are registered with Playwright during module load.
 * @throws Error when a case uses an invalid RegExp matcher in `download.expectedModRow`, `download.expectedUrl`, or `download.fileName`.
 * @throws Error when `deploy.expectedFiles` resolves to no files for the active platform.
 * @throws Error when `deploy.expectedFiles` is present and the current Node platform is not `darwin`, `linux`, or `win32`.
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
  const fileName =
    testCase.download.fileName === undefined
      ? undefined
      : compileTextMatcher(testCase.download.fileName, testCase.sourcePath, "download.fileName");
  const deploy = testCase.deploy;
  const expectedDeployFiles = resolveExpectedDeployFiles(deploy);

  test.describe(testCase.suite, () => {
    for (const variant of expandDataDrivenCase(testCase)) {
      registerManageDownloadAndDeployVariant({
        deploy,
        expectedDeployFiles,
        expectedModRow,
        expectedUrl,
        fileName,
        testCase,
        variant,
      });
    }
  });
}

/**
 * Resolves deploy expectations to the active platform file list.
 *
 * @param deploy Deploy block from a validated `manage-download-and-deploy` case.
 * @param platform Active mock-tree platform. Defaults to the current Node platform.
 * @returns Expected deploy files for the active platform, or `undefined` when the case has no deploy block.
 * @throws Error when `deploy.expectedFiles` resolves to no files for the active platform.
 * @throws Error when `platform` is omitted and the current Node platform is not `darwin`, `linux`, or `win32`.
 */
export function resolveExpectedDeployFiles(
  deploy: ManageDownloadAndDeployTestCase["deploy"],
  platform?: MockTreePlatform,
): string[] | undefined {
  return deploy?.expectedFiles === undefined
    ? undefined
    : resolveExpectedFiles(deploy.expectedFiles, platform);
}

interface ManageDownloadAndDeployVariantRegistration {
  deploy: ManageDownloadAndDeployTestCase["deploy"];
  expectedDeployFiles: string[] | undefined;
  expectedModRow: string | RegExp;
  expectedUrl: RegExp | undefined;
  fileName: string | RegExp | undefined;
  testCase: ManageDownloadAndDeployTestCase;
  variant: ReturnType<typeof expandDataDrivenCase>[number];
}

/**
 * Registers one expanded `manage-download-and-deploy` variant with Playwright.
 *
 * @param registration Precomputed expectations and fixture data for the variant.
 * @returns Nothing; the function adds nested `describe` and `test` blocks during module load.
 */
function registerManageDownloadAndDeployVariant(
  registration: ManageDownloadAndDeployVariantRegistration,
): void {
  const { deploy, expectedDeployFiles, expectedModRow, expectedUrl, fileName, testCase, variant } =
    registration;

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
          fileName,
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
          await deployAndExpectFiles(
            vortexWindow,
            managedGame.gamePath,
            expectedDeployFiles ?? [],
            {
              message: deploy.message,
              timeoutMs: Timeouts.NETWORK,
            },
          );
        });
      }
    });
  });
}
