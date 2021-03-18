module.exports = {
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
};