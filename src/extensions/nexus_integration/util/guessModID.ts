export function guessFromFileName(fileName: string): string {
  const match = fileName.match(/-([0-9]+)-/);
  if (match !== null) {
    return match[1];
  } else {
    return undefined;
  }
}
