/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  // A integracao fica fora daqui e roda com jest.integracao.config.js, para
  // quem clona o repositorio conseguir rodar a suite sem subir banco nenhum.
  testMatch: ['<rootDir>/testes/**/*.spec.ts'],
  // A integracao exige Postgres e os ponta a ponta exigem o compose de pe. Os
  // dois ficam fora daqui para `npm test` rodar numa maquina recem clonada sem
  // subir nada. Os arquivos de e2e usam o executor do Playwright e quebram se
  // o Jest tentar carrega-los, entao a exclusao tambem e tecnica.
  testPathIgnorePatterns: ['<rootDir>/testes/integracao/', '<rootDir>/testes/e2e/'],
  collectCoverageFrom: ['src/**/*.ts'],
};
