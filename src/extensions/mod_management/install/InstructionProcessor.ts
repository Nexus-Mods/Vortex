/**
 * InstructionProcessor - Handles validation and processing of mod installation instructions.
 * Extracted from InstallManager.ts for better modularity and testability.
 *
 * This class handles:
 * - Instruction validation (path validity checks)
 * - Instruction transformation (grouping by type)
 * - File-based instruction execution (mkdir, generatefile, iniedit)
 * - Orchestration of all instruction handlers
 */

import Bluebird from "bluebird";
import * as os from "os";
import * as path from "path";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import * as fs from "../../../util/fs";
import { log } from "../../../util/log";
import { getErrorCode, getErrorMessage } from "../../../shared/errors";
import { SelfCopyCheckError } from "../../../util/CustomErrors";
import { isPathValid, truthy } from "../../../util/util";

import { InstructionGroups } from "./InstructionGroups";
import type { IInvalidInstruction } from "./types/IInstallationEntry";
import type { IInstruction } from "../types/IInstallResult";

/**
 * Configuration for INI tweak processing.
 */
export interface IIniEditConfig {
  /** Path within mod directory where INI tweaks are stored */
  tweaksPath: string;
}

/**
 * Default INI tweak configuration.
 */
export const DEFAULT_INI_CONFIG: IIniEditConfig = {
  tweaksPath: "ini tweaks",
};

/**
 * Context for processing instructions.
 * Contains all the state needed during instruction processing.
 */
export interface IProcessContext {
  api: IExtensionApi;
  archivePath: string;
  tempPath: string;
  destinationPath: string;
  gameId: string;
  modId: string;
  choices?: any;
  unattended?: boolean;
}

/**
 * Callback for processing submodule instructions.
 * This is injected to break the circular dependency between
 * InstructionProcessor and InstallManager.
 */
export type SubmoduleProcessor = (
  instruction: IInstruction,
  ctx: IProcessContext,
) => Bluebird<void>;

/**
 * Callbacks for instruction processing that require external dependencies.
 */
export interface IInstructionCallbacks {
  /** Process attribute instructions */
  processAttribute?: (
    api: IExtensionApi,
    instructions: IInstruction[],
    gameId: string,
    modId: string,
  ) => Bluebird<void>;

  /** Process enableallplugins instructions */
  processEnableAllPlugins?: (
    api: IExtensionApi,
    instructions: IInstruction[],
    gameId: string,
    modId: string,
  ) => Bluebird<void>;

  /** Process setmodtype instructions */
  processSetModType?: (
    api: IExtensionApi,
    installContext: any,
    instructions: IInstruction[],
    gameId: string,
    modId: string,
  ) => Bluebird<void>;

  /** Process rule instructions */
  processRule?: (
    api: IExtensionApi,
    instructions: IInstruction[],
    gameId: string,
    modId: string,
  ) => void;

  /** Enable INI tweak for mod */
  enableIniTweak?: (
    api: IExtensionApi,
    gameId: string,
    modId: string,
    tweakId: string,
  ) => void;

  /** Process submodule - breaks circular dependency */
  processSubmodule?: SubmoduleProcessor;

  /** Report unsupported instructions */
  reportUnsupported?: (
    api: IExtensionApi,
    instructions: IInstruction[],
    archivePath: string,
  ) => void;
}

/**
 * Processes mod installation instructions.
 *
 * Provides validation, transformation, and execution of installation instructions
 * produced by mod installers (FOMOD, scripted installers, etc.).
 */
export class InstructionProcessor {
  private mIniConfig: IIniEditConfig;

  constructor(iniConfig: IIniEditConfig = DEFAULT_INI_CONFIG) {
    this.mIniConfig = iniConfig;
  }

  /**
   * Validate instructions for path validity issues.
   *
   * Checks that all destination paths are valid filesystem paths.
   * Returns an array of invalid instructions with error descriptions.
   *
   * @param instructions - Array of instructions to validate
   * @returns Array of invalid instructions (empty if all valid)
   */
  public validateInstructions(
    instructions: IInstruction[],
  ): IInvalidInstruction[] {
    const sanitizeSep = new RegExp("/", "g");

    const invalidDestinationErrors: IInvalidInstruction[] = instructions
      .filter((instr) => {
        if (instr.destination) {
          // Handle FOMOD instructions that include a leading path separator
          const destination =
            instr.destination.charAt(0) === path.sep
              ? instr.destination.substr(1)
              : instr.destination;

          // Normalize path separators for Windows
          const sanitized =
            process.platform === "win32"
              ? destination.replace(sanitizeSep, path.sep)
              : destination;

          return !isPathValid(sanitized, true);
        }
        return false;
      })
      .map((instr) => ({
        type: instr.type,
        error: `invalid destination path: "${instr.destination}"`,
      }));

    return invalidDestinationErrors;
  }

  /**
   * Transform a flat array of instructions into grouped InstructionGroups.
   *
   * Groups instructions by their type (copy, mkdir, generatefile, etc.)
   * for easier processing.
   *
   * @param instructions - Array of instructions to transform
   * @returns InstructionGroups object with instructions grouped by type
   */
  public transformInstructions(
    instructions: IInstruction[],
  ): InstructionGroups {
    return instructions.reduce((prev, value) => {
      if (truthy(value) && prev[value.type] !== undefined) {
        prev[value.type].push(value);
      }
      return prev;
    }, new InstructionGroups());
  }

  /**
   * Process mkdir instructions - create directories in the destination.
   *
   * @param instructions - mkdir instructions
   * @param destinationPath - Base destination path
   */
  public processMKDir(
    instructions: IInstruction[],
    destinationPath: string,
  ): Bluebird<void> {
    return Bluebird.each(instructions, (instruction) =>
      fs.ensureDirAsync(path.join(destinationPath, instruction.destination)),
    ).then(() => undefined);
  }

  /**
   * Process generatefile instructions - write generated files to destination.
   *
   * Generated files have their content provided inline (typically base64 encoded).
   *
   * @param instructions - generatefile instructions
   * @param destinationPath - Base destination path
   */
  public processGenerateFiles(
    instructions: IInstruction[],
    destinationPath: string,
  ): Bluebird<void> {
    return Bluebird.each(instructions, (gen) => {
      const outputPath = path.join(destinationPath, gen.destination);
      return fs
        .ensureDirAsync(path.dirname(outputPath))
        .then(() => fs.writeFileAsync(outputPath, gen.data));
    }).then(() => undefined);
  }

  /**
   * Process INI edit instructions - generate INI tweak files.
   *
   * Creates INI tweak files in the mod's tweaks directory that can be
   * selectively enabled/disabled by the user.
   *
   * @param instructions - iniedit instructions
   * @param destinationPath - Base destination path
   * @returns Object with tweakId and enabled state for each generated tweak
   */
  public processIniEdits(
    instructions: IInstruction[],
    destinationPath: string,
  ): Bluebird<Array<{ tweakId: string; enabled: boolean }>> {
    if (instructions.length === 0) {
      return Bluebird.resolve([]);
    }

    // Group by destination file
    const byDest: { [dest: string]: IInstruction[] } = instructions.reduce(
      (prev: { [dest: string]: IInstruction[] }, value) => {
        const dest = value.destination || "default.ini";
        if (!prev[dest]) {
          prev[dest] = [];
        }
        prev[dest].push(value);
        return prev;
      },
      {},
    );

    const tweaksPath = path.join(destinationPath, this.mIniConfig.tweaksPath);
    const results: Array<{ tweakId: string; enabled: boolean }> = [];

    return fs
      .ensureDirAsync(tweaksPath)
      .then(() =>
        Bluebird.map(Object.keys(byDest), (destination) => {
          // Group by section within each destination
          const bySection: { [section: string]: IInstruction[] } = byDest[
            destination
          ].reduce((prev: { [section: string]: IInstruction[] }, value) => {
            const section = value.section || "General";
            if (!prev[section]) {
              prev[section] = [];
            }
            prev[section].push(value);
            return prev;
          }, {});

          const renderKV = (instruction: IInstruction): string =>
            `${instruction.key} = ${instruction.value}`;

          const renderSection = (section: string) =>
            [`[${section}]`]
              .concat(bySection[section].map(renderKV))
              .join(os.EOL);

          const content = Object.keys(bySection)
            .map(renderSection)
            .join(os.EOL);

          const basename = path.basename(
            destination,
            path.extname(destination),
          );
          const tweakId = `From Installer [${basename}].ini`;

          results.push({ tweakId, enabled: true });

          return fs.writeFileAsync(path.join(tweaksPath, tweakId), content);
        }),
      )
      .then(() => results);
  }

  /**
   * Check if instructions contain any errors.
   *
   * @param groups - Grouped instructions
   * @returns True if there are error instructions
   */
  public hasErrors(groups: InstructionGroups): boolean {
    return groups.error.length > 0;
  }

  /**
   * Check if instructions contain fatal errors that should abort installation.
   *
   * @param groups - Grouped instructions
   * @returns The fatal error instruction, or undefined if none
   */
  public findFatalError(groups: InstructionGroups): IInstruction | undefined {
    return groups.error.find((err) => err.value === "fatal");
  }

  /**
   * Get error messages from error instructions.
   *
   * @param groups - Grouped instructions
   * @returns Array of error message strings
   */
  public getErrorMessages(groups: InstructionGroups): string[] {
    return groups.error.map((err) => err.source || "Unknown error");
  }

  /**
   * Check if instructions contain unsupported instruction types.
   *
   * @param groups - Grouped instructions
   * @returns True if there are unsupported instructions
   */
  public hasUnsupported(groups: InstructionGroups): boolean {
    return groups.unsupported.length > 0;
  }

  /**
   * Get list of unsupported instruction sources.
   *
   * @param groups - Grouped instructions
   * @returns Array of unsupported instruction source names
   */
  public getUnsupportedSources(groups: InstructionGroups): string[] {
    return groups.unsupported.map(
      (instruction) => instruction.source || "unknown",
    );
  }

  /**
   * Extract files from temp path to destination using copy instructions.
   *
   * Strategy:
   *  - Dedupe and pre-create parent directories once
   *  - Link files in parallel with bounded concurrency
   *  - If link fails (different fs, permission) fallback to copying
   *
   * @param api - Extension API for notifications
   * @param archivePath - Path to the archive (for error messages)
   * @param tempPath - Temporary extraction path
   * @param destinationPath - Final destination path
   * @param copies - Copy instructions
   * @returns Promise that resolves when extraction is complete
   */
  public async extractArchive(
    api: IExtensionApi,
    archivePath: string,
    tempPath: string,
    destinationPath: string,
    copies: IInstruction[],
  ): Promise<void> {
    const now = Date.now();
    const sorted = copies
      .slice()
      .sort((a, b) => a.destination.length - b.destination.length);
    const dirs = new Set<string>();
    const jobs: Array<{ src: string; dst: string; rel: string }> = [];
    const missingFiles = new Set<string>();

    const copyAsyncWrap = async (src: string, dst: string) => {
      try {
        await fs.copyAsync(src, dst);
      } catch (err) {
        if (
          err instanceof SelfCopyCheckError ||
          getErrorMessage(err)?.includes("and destination must")
        ) {
          // File is already there - don't care
          return;
        }
      }
    };

    for (const copy of sorted) {
      const src = path.join(tempPath, copy.source);
      const dst = path.join(destinationPath, copy.destination);
      dirs.add(path.dirname(dst));
      jobs.push({ src, dst, rel: copy.destination });
    }

    const cpuCount = os && os.cpus ? Math.max(1, os.cpus().length) : 1;
    const dirConcurrency = Math.min(64, Math.max(4, cpuCount * 2));
    const ioConcurrency = Math.min(256, Math.max(8, cpuCount * 8));

    try {
      // Create parent directories
      await Bluebird.map(Array.from(dirs), (d) => fs.ensureDirAsync(d), {
        concurrency: dirConcurrency,
      });

      // Perform hard links in parallel; fallback to copy on failure
      await Bluebird.map(
        jobs,
        async (job) => {
          try {
            await fs.linkAsync(job.src, job.dst);
          } catch (err) {
            const code = getErrorCode(err);
            if (code === "ENOENT") {
              missingFiles.add(job.src);
              return;
            }
            if (
              code &&
              ["EXDEV", "EPERM", "EACCES", "ENOTSUP", "EEXIST"].includes(code)
            ) {
              await copyAsyncWrap(job.src, job.dst);
            } else {
              throw err;
            }
          }
        },
        { concurrency: ioConcurrency },
      );

      if (missingFiles.size > 0) {
        api.showErrorNotification(
          api.translate("Invalid installer"),
          api.translate(
            'The installer in "{{name}}" tried to install files that were ' +
              "not part of the archive.\n This can be due to an invalid mod or an invalid game extension installer.\n" +
              "Please report this to the mod author and/or the game extension developer.",
            { replace: { name: path.basename(archivePath) } },
          ) +
            "\n\n" +
            Array.from(missingFiles)
              .map((name) => "- " + name)
              .join("\n"),
          { allowReport: false },
        );
      }
    } finally {
      log("debug", "extraction completed", {
        duration: Date.now() - now,
        archivePath,
        instructions: copies.length,
      });
    }
  }

  /**
   * Process all instructions using the provided callbacks.
   *
   * This is the main orchestration method that processes all instruction types
   * in the correct order.
   *
   * @param groups - Grouped instructions
   * @param ctx - Processing context
   * @param installContext - Install context for mod type changes
   * @param callbacks - Callbacks for instruction types that need external dependencies
   */
  public async processAll(
    groups: InstructionGroups,
    ctx: IProcessContext,
    installContext: any,
    callbacks: IInstructionCallbacks,
  ): Promise<void> {
    const { api, archivePath, tempPath, destinationPath, gameId, modId } = ctx;

    // Report unsupported instructions
    if (callbacks.reportUnsupported) {
      callbacks.reportUnsupported(api, groups.unsupported, archivePath);
    }

    // 1. Create directories first
    await this.processMKDir(groups.mkdir, destinationPath);

    // 2. Extract/copy files from archive
    await this.extractArchive(
      api,
      archivePath,
      tempPath,
      destinationPath,
      groups.copy,
    );

    // 3. Generate files
    await this.processGenerateFiles(groups.generatefile, destinationPath);

    // 4. Process INI edits
    const tweaks = await this.processIniEdits(groups.iniedit, destinationPath);
    if (callbacks.enableIniTweak) {
      for (const tweak of tweaks) {
        callbacks.enableIniTweak(api, gameId, modId, tweak.tweakId);
      }
    }

    // 5. Process submodules (if callback provided)
    if (callbacks.processSubmodule && groups.submodule.length > 0) {
      for (const submoduleInstr of groups.submodule) {
        await callbacks.processSubmodule(submoduleInstr, ctx);
      }
    }

    // 6. Process attributes
    if (callbacks.processAttribute) {
      await callbacks.processAttribute(api, groups.attribute, gameId, modId);
    }

    // 7. Process enableallplugins
    if (callbacks.processEnableAllPlugins) {
      await callbacks.processEnableAllPlugins(
        api,
        groups.enableallplugins,
        gameId,
        modId,
      );
    }

    // 8. Process setmodtype
    if (callbacks.processSetModType) {
      await callbacks.processSetModType(
        api,
        installContext,
        groups.setmodtype,
        gameId,
        modId,
      );
    }

    // 9. Process rules
    if (callbacks.processRule) {
      callbacks.processRule(api, groups.rule, gameId, modId);
    }
  }
}

/**
 * Standalone validation function for use without class instantiation.
 */
export function validateInstructions(
  instructions: IInstruction[],
): IInvalidInstruction[] {
  const processor = new InstructionProcessor();
  return processor.validateInstructions(instructions);
}

/**
 * Standalone transformation function for use without class instantiation.
 */
export function transformInstructions(
  instructions: IInstruction[],
): InstructionGroups {
  const processor = new InstructionProcessor();
  return processor.transformInstructions(instructions);
}
