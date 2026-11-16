/** ScrollIntoView's `container`, which Chromium has had since 140; TypeScript's DOM types lack it. */
interface ScrollIntoViewOptions {
  /** `nearest` scrolls only the element's nearest scroll container, not every one above it. */
  container?: "all" | "nearest";
}
