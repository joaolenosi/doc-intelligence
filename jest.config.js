/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  // A integracao fica fora daqui e roda com jest.integracao.config.js, para
  // quem clona o repositorio conseguir rodar a suite sem subir banco nenhum.
  testMatch: ['<rootDir>/testes/**/*.spec.ts'],
  testPathIgnorePatterns: ['<rootDir>/testes/integracao/'],
  collectCoverageFrom: ['src/**/*.ts'],
};
