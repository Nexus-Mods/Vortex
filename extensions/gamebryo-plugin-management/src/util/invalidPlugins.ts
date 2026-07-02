// LOOT reports an unparseable plugin in two forms depending on where parsing fails: during the
// sort ("<name>" is not a valid plugin) or during the initial load of the set (failed validation of
// input plugin paths: the file at "<path>" does not have a valid plugin header). A failed load can
// name more than one path, so collect every plugin the message references, as basenames, deduped,
// letting callers drop them all and keep the valid ones.
export function invalidPluginsFromError(message: string): string[] {
  const found = new Set<string>();
  const patterns = [
    /"([^"]+)" is not a valid plugin/g,
    /the file at "([^"]+)" does not have a valid plugin header/gi,
  ];
  for (const pattern of patterns) {
    for (const match of message.matchAll(pattern)) {
      found.add(basename(match[1]));
    }
  }
  return [...found];
}

// LOOT always reports Windows paths, but this code runs on any platform (e.g. CI on Linux), where
// path.basename would only split on "/" and leave a "C:\...\plugin.esp" path untouched. Split on
// both separators so the basename is extracted regardless of the platform we run on.
function basename(filePath: string): string {
  const segments = filePath.split(/[\\/]/);
  return segments[segments.length - 1];
}
