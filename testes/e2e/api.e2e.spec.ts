import { expect, test } from '@playwright/test';
import { SISTEMA, enviar, esperarSituacaoFinal, jpeg } from './apoio';

/**
 * Contra o ambiente do `docker compose`, pela rede.
 *
 * O que estes testes provam e o que os de integracao nao provam: que a imagem
 * sobe, que a API e o worker sao processos separados que se enxergam pela fila,
 * e que o contrato funciona para quem esta do outro lado de um socket.
 */

test.describe('fronteira de autenticacao', () => {
  test('healthz responde sem chave e consulta o banco', async ({ request }) => {
    const resposta = await request.get('/healthz', { headers: { 'x-api-key': '' } });
    expect(resposta.status()).toBe(200);
    expect(await resposta.json()).toEqual({ estado: 'ok', banco: 'ok' });
  });

  test('recusa sem chave', async ({ request }) => {
    const resposta = await request.get('/v1/documentos/1', { headers: { 'x-api-key': '' } });
    expect(resposta.status()).toBe(401);
  });

  test('recusa com chave errada', async ({ request }) => {
    const resposta = await request.get('/v1/documentos/1', {
      headers: { 'x-api-key': 'chave-errada' },
    });
    expect(resposta.status()).toBe(401);
    // A resposta nao repete o que foi enviado nem diz se a chave estava ausente
    // ou errada, porque a diferenca so ajuda quem esta adivinhando.
    expect(JSON.stringify(await resposta.json())).not.toContain('chave-errada');
  });
});

test.describe('recebimento', () => {
  test('responde 201 na hora, com Location', async ({ request }) => {
    const resposta = await enviar(request, {
      conteudo: jpeg(`novo-${Date.now()}`),
      nome: 'WhatsApp Image 2026-08-11 at 09.12.33.jpeg',
      sistema: SISTEMA,
    });

    expect(resposta.status()).toBe(201);
    const corpo = await resposta.json();
    expect(corpo.estado).toBe('RECEIVED');
    expect(corpo.tipoMidia).toBe('image/jpeg');
    expect(resposta.headers()['location']).toBe(`/v1/documentos/${corpo.id}`);
  });

  test('exige o sistema de origem', async ({ request }) => {
    const resposta = await enviar(request, {
      conteudo: jpeg(`sem-sistema-${Date.now()}`),
      nome: 'a.jpg',
    });
    expect(resposta.status()).toBe(400);
  });

  // O tipo sai dos bytes. A extensao mente e nao importa. Fato (b).
  test('responde 415 para executavel com nome de imagem', async ({ request }) => {
    const resposta = await enviar(request, {
      conteudo: Buffer.from('MZ executavel disfarcado de identidade'),
      nome: 'rg.jpeg',
      sistema: SISTEMA,
    });

    expect(resposta.status()).toBe(415);
    const corpo = await resposta.json();
    expect(corpo.erro).toBe('TIPO_NAO_SUPORTADO');
    // Fato (d): a resposta de erro nao devolve o que foi enviado.
    expect(JSON.stringify(corpo)).not.toContain('executavel');
  });

  test('responde 413 acima do limite de 25 MB', async ({ request }) => {
    const grande = Buffer.concat([jpeg('grande'), Buffer.alloc(26 * 1024 * 1024)]);
    const resposta = await enviar(request, { conteudo: grande, nome: 'scan.jpg', sistema: SISTEMA });
    expect(resposta.status()).toBe(413);
  });
});

test.describe('consulta', () => {
  test('responde 404 para id inexistente', async ({ request }) => {
    expect((await request.get('/v1/documentos/99999999')).status()).toBe(404);
  });

  test('nao devolve campos antes de existir resultado', async ({ request }) => {
    const criado = await enviar(request, {
      conteudo: jpeg(`pendente-${Date.now()}`),
      nome: 'pendente.jpg',
      sistema: SISTEMA,
    });
    const { id } = await criado.json();

    const consulta = await request.get(`/v1/documentos/${id}`);
    const corpo = await consulta.json();
    // O worker e rapido com o duble, entao o documento pode ja ter sido
    // processado. O que nao pode e existir campo sem resultado.
    if (corpo.estado === 'RECEIVED' || corpo.estado === 'PROCESSING') {
      expect(corpo.campos).toEqual([]);
      expect(corpo.nomePadronizado).toBeNull();
    }
  });
});

/**
 * A fatia inteira, com o worker de verdade do outro lado da fila. E o unico
 * teste do projeto que prova que os dois processos se enxergam.
 */
test('o worker processa e o GET devolve o nome padronizado', async ({ request }) => {
  const criado = await enviar(request, {
    conteudo: jpeg(`completo-${Date.now()}`),
    nome: 'IMG_0042.jpeg',
    sistema: SISTEMA,
  });
  expect(criado.status()).toBe(201);
  const { id } = await criado.json();

  const final = await esperarSituacaoFinal(request, id);

  expect(['PROCESSED', 'REVIEW_REQUIRED']).toContain(final.estado);
  expect(final.tipoDocumento).not.toBeNull();
  expect(final.campos.length).toBeGreaterThan(0);
  // Fato (f): quem consome consegue apontar o que mudou depois de uma troca.
  expect(final.processamento.provedor).toBe('duble');
  expect(final.processamento.modelo).toBe('duble-deterministico-1');
  expect(final.processamento.versaoPrompt).toMatch(/\.v\d+$/);
  expect(final.processamento.tentativas).toBe(1);
});

/**
 * Fato (c). O mesmo conteudo chega por dois canais, e o servico paga uma
 * chamada so enquanto registra os dois envios.
 */
test('reenvio devolve 200, registra a submissao e nao paga de novo', async ({ request }) => {
  const conteudo = jpeg(`reenvio-${Date.now()}`);

  const primeiro = await enviar(request, {
    conteudo,
    nome: 'WhatsApp Image 2026-08-11 at 09.12.33.jpeg',
    sistema: SISTEMA,
  });
  expect(primeiro.status()).toBe(201);
  const { id } = await primeiro.json();

  const segundo = await enviar(request, {
    conteudo,
    nome: 'procuracao-registro-casa.pdf',
    sistema: 'portal-balcao',
  });
  expect(segundo.status()).toBe(200);
  expect((await segundo.json()).id).toBe(id);

  const final = await esperarSituacaoFinal(request, id);
  expect(final.submissoes.total).toBe(2);
  expect(final.submissoes.canais.slice().sort()).toEqual(['crm-atendimento', 'portal-balcao']);
  expect(final.submissoes.nomeOriginalMaisRecente).toBe('procuracao-registro-casa.pdf');
  // Uma chamada so, apesar de dois envios. E o custo do fato (a) sendo poupado.
  expect(final.processamento.tentativas).toBe(1);
});

/**
 * Idempotencia de requisicao e coisa diferente de reenvio, e tem mecanismo
 * diferente. Ver ADR-006.
 */
test.describe('idempotencia de requisicao', () => {
  test('a mesma chave do mesmo sistema nao cria submissao nova', async ({ request }) => {
    const conteudo = jpeg(`idem-mesmo-${Date.now()}`);
    const chave = `req-${Date.now()}`;

    const primeiro = await enviar(request, {
      conteudo,
      nome: 'a.jpg',
      sistema: SISTEMA,
      chaveIdempotencia: chave,
    });
    const repetido = await enviar(request, {
      conteudo,
      nome: 'a.jpg',
      sistema: SISTEMA,
      chaveIdempotencia: chave,
    });

    const { id } = await primeiro.json();
    expect((await repetido.json()).id).toBe(id);

    const final = await esperarSituacaoFinal(request, id);
    expect(final.submissoes.total).toBe(1);
  });

  test('a mesma chave de sistemas diferentes conta como dois envios', async ({ request }) => {
    const conteudo = jpeg(`idem-outro-${Date.now()}`);
    const chave = `req-${Date.now()}`;

    const primeiro = await enviar(request, {
      conteudo,
      nome: 'a.jpg',
      sistema: SISTEMA,
      chaveIdempotencia: chave,
    });
    await enviar(request, {
      conteudo,
      nome: 'b.jpg',
      sistema: 'portal-balcao',
      chaveIdempotencia: chave,
    });

    const { id } = await primeiro.json();
    const final = await esperarSituacaoFinal(request, id);
    expect(final.submissoes.total).toBe(2);
  });
});
