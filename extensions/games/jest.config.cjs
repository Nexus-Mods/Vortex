/** @type {import('jest').Config} */
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  testMatch: [
    '<rootDir>/game-stardewvalley/__tests__/**/*.test.ts',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/out/',
  ],
  moduleNameMapper: {
    '^vortex-api$': '<rootDir>/game-stardewvalley/__mocks__/vortex-api.ts',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
};
