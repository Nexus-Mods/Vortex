export function fileMD5(
  _fileName: string,
  callback: (err: Error | null, result: string) => void,
  _progress: () => void,
) {
  callback(null, "deadbeef");
}
