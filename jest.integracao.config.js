/**
 * Testes que precisam de Postgres de verdade.
 *
 * Ficam separados do `npm test` de proposito: quem clona o repositorio consegue
 * rodar a suite inteira sem subir nada, e quem quer a verificacao contra o
 * banco roda `npm run test:integracao` depois de `docker compose up -d
 * postgres`. Misturar as duas faria a suite inteira falhar na maquina de quem
 * so queria ler o codigo.
 */
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/testes/integracao/**/*.spec.ts'],
  // Cria o banco de testes antes de tudo. Ele e separado do banco do compose
  // de proposito: com o ambiente de pe, o worker consome a mesma fila.
  globalSetup: '<rootDir>/testes/integracao/preparar-banco.ts',
  testTimeout: 30000,
  maxWorkers: 1,
};
