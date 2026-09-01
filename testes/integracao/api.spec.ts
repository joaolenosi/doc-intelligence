import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { Configuracao } from '../../src/infraestrutura/config/configuracao';
import { ApiModule } from '../../src/infraestrutura/modulos/api.module';
import { compor } from '../../src/infraestrutura/modulos/composicao';
import contrato from '../../docs/contrato-openapi.json';
import { conectar, limpar } from './ambiente';

const CHAVE = 'chave-de-teste';
const cabecalhos = { 'x-api-key': CHAVE, 'x-sistema-origem': 'crm-atendimento' };

const jpeg = (marcador: string) =>
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new TextEncoder().encode(marcador), ...new Array(64).fill(0)]);

let app: INestApplication;
let ds: DataSource;
let diretorio: string;
let configuracao: Configuracao;

beforeAll(async () => {
  ds = await conectar();
  diretorio = await mkdtemp(join(tmpdir(), 'doc-api-'));
  configuracao = {
    banco: { host: '', porta: 0, usuario: '', senha: '', base: '' },
    // O adaptador de fila no teste e o de Postgres, para a suite nao depender
    // de Redis no ar. A troca por variavel e o ponto do ADR-004.
    fila: { adaptador: 'postgres', concorrencia: 1, redisHost: '', redisPorta: 0 },
    extrator: { modoDoDuble: 'SUCESSO', timeoutMs: 5000, maxTentativas: 3 },
    confianca: { limiarTipo: 0.8, limiarCampo: 0.85 },
    upload: { tamanhoMaximoBytes: 1024 * 1024 },
    armazenamento: { diretorio },
    documentacao: { habilitada: false },
    apiKey: CHAVE,
  };

  app = await NestFactory.create(ApiModule.registrar(configuracao, ds), { logger: false });
  await app.init();
});

afterAll(async () => {
  await app?.close();
  if (ds?.isInitialized) await ds.destroy();
  await rm(diretorio, { recursive: true, force: true });
});

beforeEach(() => limpar(ds));

const servidor = () => request(app.getHttpServer());

describe('API', () => {
  describe('fronteira de autenticacao', () => {
    it('recusa sem chave', async () => {
      await servidor().get('/v1/documentos/1').expect(401);
    });

    it('recusa com chave errada', async () => {
      await servidor().get('/v1/documentos/1').set('x-api-key', 'outra').expect(401);
    });

    // A excecao e declarada com @SemAutenticacao na rota, e nao adivinhada por
    // caminho dentro do guard.
    it('deixa healthz passar sem chave', async () => {
      await servidor().get('/healthz').expect(200, { estado: 'ok', banco: 'ok' });
    });
  });

  describe('POST /v1/documentos', () => {
    it('responde 201 na hora, sem esperar o modelo', async () => {
      const resposta = await servidor()
        .post('/v1/documentos')
        .set(cabecalhos)
        .attach('arquivo', jpeg('rg'), 'WhatsApp Image 2026-08-11 at 09.12.33.jpeg')
        .expect(201);

      expect(resposta.body).toMatchObject({ estado: 'RECEIVED', tipoMidia: 'image/jpeg' });
      expect(resposta.headers.location).toBe(`/v1/documentos/${resposta.body.id}`);
    });

    /**
     * Fato (c). O 200 nao significa "nao fiz nada": o documento nao e
     * reprocessado, mas a submissao e registrada. Ver ADR-006.
     */
    it('responde 200 no reenvio e conta a submissao nova', async () => {
      const bytes = jpeg('mesmo documento');
      const primeiro = await servidor()
        .post('/v1/documentos')
        .set(cabecalhos)
        .attach('arquivo', bytes, 'primeiro.jpg')
        .expect(201);

      const segundo = await servidor()
        .post('/v1/documentos')
        .set({ ...cabecalhos, 'x-sistema-origem': 'portal-balcao' })
        .attach('arquivo', bytes, 'scan0001.pdf')
        .expect(200);

      expect(segundo.body.id).toBe(primeiro.body.id);

      const consulta = await servidor()
        .get(`/v1/documentos/${primeiro.body.id}`)
        .set(cabecalhos)
        .expect(200);

      expect(consulta.body.submissoes).toEqual({
        total: 2,
        canais: expect.arrayContaining(['crm-atendimento', 'portal-balcao']),
        nomeOriginalMaisRecente: 'scan0001.pdf',
      });
    });

    it('exige o sistema de origem, porque a idempotencia e por par', async () => {
      await servidor()
        .post('/v1/documentos')
        .set('x-api-key', CHAVE)
        .attach('arquivo', jpeg('x'), 'a.jpg')
        .expect(400);
    });

    it('recusa multipart sem o campo arquivo', async () => {
      await servidor().post('/v1/documentos').set(cabecalhos).expect(400);
    });

    // O tipo sai dos bytes. A extensao mente e nao importa. Fato (b).
    it('responde 415 para conteudo que nao e documento, mesmo com nome .jpeg', async () => {
      const resposta = await servidor()
        .post('/v1/documentos')
        .set(cabecalhos)
        .attach('arquivo', Buffer.from('MZ este e um executavel'), 'rg.jpeg')
        .expect(415);

      expect(resposta.body.erro).toBe('TIPO_NAO_SUPORTADO');
      // Fato (d): a resposta de erro nao ecoa o conteudo enviado.
      expect(JSON.stringify(resposta.body)).not.toContain('executavel');
    });

    it('responde 413 acima do limite', async () => {
      await servidor()
        .post('/v1/documentos')
        .set(cabecalhos)
        .attach('arquivo', Buffer.alloc(2 * 1024 * 1024, 1), 'grande.jpg')
        .expect(413);
    });
  });

  describe('GET /v1/documentos/:id', () => {
    it('responde 404 para id inexistente', async () => {
      await servidor().get('/v1/documentos/999999').set(cabecalhos).expect(404);
    });

    it('nao devolve campos enquanto o documento nao foi processado', async () => {
      const criado = await servidor()
        .post('/v1/documentos')
        .set(cabecalhos)
        .attach('arquivo', jpeg('pendente'), 'a.jpg')
        .expect(201);

      const consulta = await servidor()
        .get(`/v1/documentos/${criado.body.id}`)
        .set(cabecalhos)
        .expect(200);

      expect(consulta.body.estado).toBe('RECEIVED');
      expect(consulta.body.campos).toEqual([]);
      expect(consulta.body.nomePadronizado).toBeNull();
      expect(consulta.body.processamento.tentativas).toBe(0);
    });
  });

  /**
   * A fatia vertical inteira: recebe, enfileira, o worker processa e a consulta
   * devolve o resultado com o nome padronizado.
   */
  it('percorre o caminho completo, do upload ao nome padronizado', async () => {
    const criado = await servidor()
      .post('/v1/documentos')
      .set(cabecalhos)
      .attach('arquivo', jpeg('documento completo'), 'IMG_0042.jpeg')
      .expect(201);

    // O trabalho foi publicado na fila em banco, dentro da mesma transacao.
    const fila = await ds.query('SELECT flp_doc_id, flp_situacao FROM fila_processamento');
    expect(fila).toHaveLength(1);
    expect(Number(fila[0].flp_doc_id)).toBe(criado.body.id);

    // O worker roda aqui, em vez de subir o processo separado: o que este teste
    // verifica e o fluxo, e nao o supervisor de processo.
    const { processar } = compor({ configuracao, dataSource: ds });
    await processar.executar(criado.body.id);

    const consulta = await servidor()
      .get(`/v1/documentos/${criado.body.id}`)
      .set(cabecalhos)
      .expect(200);

    expect(consulta.body.estado).toBe('PROCESSED');
    expect(consulta.body.nomePadronizado).toMatch(/^[A-Z_]+_.*\.jpg$/);
    expect(consulta.body.campos.length).toBeGreaterThan(0);
    // Fato (f): quem consome consegue apontar o que mudou depois de uma troca.
    expect(consulta.body.processamento).toMatchObject({
      tentativas: 1,
      provedor: 'duble',
      modelo: 'duble-deterministico-1',
    });
    expect(consulta.body.processamento.versaoPrompt).toMatch(/\.v\d+$/);
  });
});

/**
 * O contrato descreve a forma da resposta em classes de DTO, e quem monta a
 * resposta e o apresentador. Sao dois lugares, e dois lugares divergem.
 *
 * Este teste fecha a duplicacao: ele compara as chaves da resposta de verdade,
 * vinda do banco e do apresentador, com as chaves documentadas no contrato
 * versionado. E a garantia que o ADR-013 promete.
 */
describe('a resposta real bate com o contrato documentado', () => {
  const chavesDocumentadas = (schema: string): string[] =>
    Object.keys((contrato as any).components.schemas[schema].properties).sort();

  it('o recebimento devolve exatamente o que o contrato descreve', async () => {
    const resposta = await servidor()
      .post('/v1/documentos')
      .set(cabecalhos)
      .attach('arquivo', jpeg('forma-recebimento'), 'a.jpg')
      .expect(201);

    expect(Object.keys(resposta.body).sort()).toEqual(chavesDocumentadas('RespostaDeRecebimento'));
  });

  it('a consulta devolve exatamente o que o contrato descreve, em todos os niveis', async () => {
    const criado = await servidor()
      .post('/v1/documentos')
      .set(cabecalhos)
      .attach('arquivo', jpeg('forma-consulta'), 'a.jpg')
      .expect(201);

    const { processar } = compor({ configuracao, dataSource: ds });
    await processar.executar(criado.body.id);

    const consulta = await servidor()
      .get(`/v1/documentos/${criado.body.id}`)
      .set(cabecalhos)
      .expect(200);

    expect(Object.keys(consulta.body).sort()).toEqual(chavesDocumentadas('RespostaDeConsulta'));
    expect(Object.keys(consulta.body.submissoes).sort()).toEqual(
      chavesDocumentadas('SubmissoesDaResposta'),
    );
    expect(Object.keys(consulta.body.processamento).sort()).toEqual(
      chavesDocumentadas('ProcessamentoDaResposta'),
    );
    expect(consulta.body.campos.length).toBeGreaterThan(0);
    expect(Object.keys(consulta.body.campos[0]).sort()).toEqual(
      chavesDocumentadas('CampoDaResposta'),
    );
  });

  it('o erro devolve exatamente o que o contrato descreve', async () => {
    const resposta = await servidor()
      .post('/v1/documentos')
      .set(cabecalhos)
      .attach('arquivo', Buffer.from('MZ nao e documento'), 'rg.jpeg')
      .expect(415);

    expect(Object.keys(resposta.body).sort()).toEqual(chavesDocumentadas('RespostaDeErro'));
  });
});
