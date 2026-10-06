/** 7-Zip exit code for an extraction that finished with warnings only. */
const SEVENZIP_WARNING = 1;

/** Why an extraction cannot be trusted, or undefined when it can. node-7z resolves on failure too. */
export function extractionProblem(result: { code: number; errors?: string[] }): string | undefined {
  if (result.code === 0 || result.code === SEVENZIP_WARNING) {
    return undefined;
  }
  const errors = result.errors ?? [];
  return errors.length > 0 ? errors.join("; ") : `7-Zip exited with code ${result.code}`;
}
