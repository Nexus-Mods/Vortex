export function dir(
  callback: (err: Error | null, path: string, cleanup: () => void) => void,
) {
  callback(null, "/tmp/mock", () => {});
}
