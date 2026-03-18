import * as path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      'vortex-api': path.resolve(__dirname, '__mocks__/vortex-api.ts'),
    },
  },
  test: {
    name: 'game-stardewvalley',
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'out'],
  },
});
