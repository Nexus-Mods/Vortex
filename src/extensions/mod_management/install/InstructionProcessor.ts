/**
 * InstructionProcessor - Handles validation and processing of mod installation instructions.
 * Extracted from InstallManager.ts for better modularity and testability.
 *
 * This class handles:
 * - Instruction validation (path validity checks)
 * - Instruction transformation (grouping by type)
 * - File-based instruction execution (mkdir, generatefile, iniedit)
 */

import Bluebird from "bluebird";
import * as os from "os";
import * as path from "path";

import * as fs from "../../../util/fs";
import { log } from "../../../util/log";
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
