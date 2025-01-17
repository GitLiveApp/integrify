export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.(ts)$",
  coverageReporters: [
    'text',
    'text-summary',
  ],
  roots: [
    '<rootDir>/__test__',
    '<rootDir>',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts'
  ],
  reporters: [
    'default',
    ['jest-junit', {
      'suiteName': 'jest tests'
    }]
  ],
  setupFiles: [
    '<rootDir>/__test__/test.setup.ts',
  ],
};