/**
 * Groups installation instructions by type for processing.
 * Extracted from InstallManager.ts for better modularity.
 */
import type { IInstruction } from "../types/IInstallResult";

/**
 * Container for categorizing installation instructions by type.
 * Each array holds instructions of that specific type for batch processing.
 */
export class InstructionGroups {
  public copy: IInstruction[] = [];
  public mkdir: IInstruction[] = [];
  public submodule: IInstruction[] = [];
  public generatefile: IInstruction[] = [];
  public iniedit: IInstruction[] = [];
  public unsupported: IInstruction[] = [];
  public attribute: IInstruction[] = [];
  public setmodtype: IInstruction[] = [];
  public error: IInstruction[] = [];
  public rule: IInstruction[] = [];
  public enableallplugins: IInstruction[] = [];
}
