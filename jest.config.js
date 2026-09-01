/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/testes/**/*.spec.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
};
