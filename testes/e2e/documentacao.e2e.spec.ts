import { expect, test } from '@playwright/test';

/**
 * A documentacao no ar, e a raiz continuando em 404.
 *
 * O 404 na raiz e comportamento pedido, e nao esquecimento: nao existe rota nem
 * redirecionamento ali. Quem sobe o projeto acha o caminho pelo log de subida e
 * pelo README.
 */
test.describe('documentacao do contrato', () => {
  /**
   * A raiz ja respondeu 404 de proposito. A decisao foi revista, e o registro
   * esta na revisao do ADR-013: o 404 evitava rota escondida e nao resolvia o
   * problema de alguem abrir o servico e nao saber para onde ir.
   */
  test('a raiz lista os endpoints, sem exigir chave', async ({ request }) => {
    const resposta = await request.get('/', {
      headers: { 'x-api-key': '' },
      maxRedirects: 0,
    });
    expect(resposta.status()).toBe(200);

    const corpo = await resposta.json();
    expect(corpo.servico).toBe('DOC Intelligence');
    // Links absolutos, montados a partir do proprio pedido, para funcionarem
    // colados no navegador.
    expect(corpo.documentacao).toMatch(/\/v1\/docs$/);
    expect(corpo.saude).toMatch(/\/healthz$/);
    // Operacoes com metodo e template, e nao link cru: /v1/documentos so aceita
    // POST, entao um link ali daria 404 para quem clicasse.
    expect(corpo.endpoints).toEqual([
      { metodo: 'POST', caminho: '/v1/documentos', descricao: expect.any(String) },
      { metodo: 'GET', caminho: '/v1/documentos/{id}', descricao: expect.any(String) },
    ]);
  });

  /**
   * Uma raiz de descoberta que anuncia link quebrado e pior do que raiz
   * nenhuma. Este teste segue cada link e cobra que ele leve a algum lugar.
   */
  test('todo link absoluto da raiz responde 200 sem chave', async ({ request }) => {
    const raiz = await (await request.get('/', { headers: { 'x-api-key': '' } })).json();

    for (const link of [raiz.saude, raiz.documentacao]) {
      const resposta = await request.get(link, { headers: { 'x-api-key': '' } });
      expect({ link, status: resposta.status() }).toEqual({ link, status: 200 });
    }
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
      '/',
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
