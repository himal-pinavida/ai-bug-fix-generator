/** Jest config: ts-jest, unit (*.spec.ts) and HTTP e2e (*.e2e-spec.ts). */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '\\.(spec|e2e-spec)\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  collectCoverageFrom: ['src/**/*.ts'],
  coveragePathIgnorePatterns: ['main.ts'],
  testEnvironment: 'node',
  testTimeout: 30000,
};
