import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    setupFiles: ["./test-setup.ts"],

    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "**/__tests__/*"],
  },
});
