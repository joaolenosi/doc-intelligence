import { expect, test } from '@playwright/test';

/**
 * A documentacao no ar, e a raiz continuando em 404.
 *
 * O 404 na raiz e comportamento pedido, e nao esquecimento: nao existe rota nem
 * redirecionamento ali. Quem sobe o projeto acha o caminho pelo log de subida e
 * pelo README.
 */
test.describe('documentacao do contrato', () => {
  test('a raiz responde 404, sem rota e sem redirecionamento', async ({ request }) => {
    const resposta = await request.get('/', { maxRedirects: 0 });
    expect(resposta.status()).toBe(404);
  });

  test('a documentacao responde em /v1/docs', async ({ request }) => {
    const resposta = await request.get('/v1/docs/', { headers: { 'x-api-key': '' } });
    expect(resposta.status()).toBe(200);
    expect(await resposta.text()).toContain('DOC Intelligence');
  });

  // A rota do Swagger e montada abaixo do pipeline do Nest e nao passa pelo
  // guard. Isso e escolha registrada no ADR-013, e o teste afirma o estado real
  // para ele nao mudar sem alguem perceber.
  test('a documentacao fica fora do guard, por decisao do ADR-013', async ({ request }) => {
    const semChave = await request.get('/v1/docs-json', { headers: { 'x-api-key': '' } });
    expect(semChave.status()).toBe(200);

    const contrato = await semChave.json();
    expect(Object.keys(contrato.paths).sort()).toEqual([
      '/healthz',
      '/v1/documentos',
      '/v1/documentos/{id}',
    ]);
  });

  // O contrato servido pela aplicacao e o mesmo que esta versionado. Se
  // divergirem, o arquivo em docs/ virou foto velha.
  test('o contrato servido bate com o versionado', async ({ request }) => {
    const servido = await (await request.get('/v1/docs-json', { headers: { 'x-api-key': '' } })).json();
    const versionado = require('../../docs/contrato-openapi.json');
    expect(servido).toEqual(versionado);
  });
});
