import * as path from "node:path";
import { defineConfig } from "vitest/config";

const RESULTS_DIR = path.join(import.meta.dirname, "test-results");

export default defineConfig({
  test: {
    projects: ["./src/main", "./src/renderer", "./src/shared"],
    reporters: ["default", "junit"],
    outputFile: {
      junit: path.join(RESULTS_DIR, "junit.xml"),
    },
  },
});
