import { defineConfig } from '@playwright/test';

/**
 * Testes ponta a ponta contra o ambiente subido no Docker.
 *
 * Nao ha projeto de navegador aqui, e isso e proposital: a Trilha A nao tem
 * interface, entao a automacao de navegador do Playwright nao tem alvo. O que
 * se aproveita e o executor de testes de API, que faz chamada HTTP de verdade.
 *
 * Isso e diferente do que o Supertest ja cobre. O Supertest sobe o Nest dentro
 * do Jest e prova o fluxo; ele nao prova que a imagem sobe, que o worker
 * separado consome, nem que a rede entre os containers funciona. Aqui as
 * chamadas saem pela porta 3000 do compose e o worker de verdade e quem
 * processa.
 *
 * Exige `docker compose up -d --build` antes. Por isso fica fora do `npm test`.
 */
export default defineConfig({
  testDir: './testes/e2e',
  // Sequencial: os testes compartilham um banco unico, que e o do ambiente
  // real, e paralelismo aqui trocaria uma verificacao honesta por corrida.
  workers: 1,
  fullyParallel: false,
  // O worker leva alguns segundos para pegar o trabalho e chamar o duble.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['json', { outputFile: 'testes/e2e/resultado.json' }]],
  use: {
    baseURL: process.env.URL_BASE ?? 'http://localhost:3000',
    extraHTTPHeaders: { 'x-api-key': process.env.API_KEY ?? 'chave-de-desenvolvimento' },
  },
});
