export class ReplicateHashMismatchError extends Error {
  mayIgnore: boolean = false;
  //affectedFiles: string[];
  constructor() {
    super(
      "Replicate install mode can only work if the checksums of the installed files match those in the archive. Please try to reinstall the mod or use binary patching instead.",
    );
    this.name = "ReplicateHashMismatchError";
    this.mayIgnore = false;
  }
}
