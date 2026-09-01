import { Queue } from 'bullmq';
import { PublicadorBullMq } from '../../src/infraestrutura/fila/bullmq/publicador-bullmq.adapter';
import { FILA_DE_PROCESSAMENTO } from '../../src/infraestrutura/fila/nome-da-fila';

/**
 * Roda contra o Redis de verdade.
 *
 * Existe porque o teste ponta a ponta da API usa o adaptador de Postgres, para
 * a suite nao depender de Redis, e isso deixou o caminho do BullMQ sem
 * cobertura. A consequencia apareceu so quando o ambiente inteiro subiu no
 * Docker: todo upload respondia 500 com "Custom Ids cannot be integers",
 * porque o BullMQ recusa id customizado que pareca inteiro.
 *
 * A licao que ficou: dois adaptadores reais precisam de dois testes reais, ou
 * um deles e so um arquivo que compila.
 */
const conexao = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
};

/**
 * Fila propria, e nao a de producao.
 *
 * Pela mesma razao que a integracao usa um banco proprio: com o ambiente de pe,
 * o worker do compose esta conectado no mesmo Redis e consome a fila de
 * verdade. O teste publicava, o worker consumia antes da verificacao, e a
 * contagem dava zero em cerca de metade das execucoes.
 *
 * A licao repetiu dos dois lados, Postgres e Redis, e e a mesma: teste de
 * integracao que compartilha infraestrutura com o ambiente em execucao nao esta
 * medindo o proprio codigo, esta disputando com outro processo.
 */
const FILA_DE_TESTE = `${FILA_DE_PROCESSAMENTO}-teste`;

let fila: Queue;

beforeAll(() => {
  fila = new Queue(FILA_DE_TESTE, { connection: conexao });
});

afterAll(async () => {
  await fila.obliterate({ force: true }).catch(() => undefined);
  await fila.close();
});

beforeEach(async () => {
  await fila.obliterate({ force: true }).catch(() => undefined);
});

describe('fila em BullMQ', () => {
  it('publica o trabalho com o id do documento no payload', async () => {
    await new PublicadorBullMq(fila, 3).publicar(42);

    const jobs = await fila.getWaiting();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].data).toEqual({ documentoId: 42 });
    expect(jobs[0].opts.attempts).toBe(3);
  });

  // O BullMQ recusa id customizado que pareca inteiro, e sem o prefixo todo
  // upload respondia 500. So o Redis de verdade mostra isso.
  it('aceita o id derivado do documento, com prefixo', async () => {
    await new PublicadorBullMq(fila, 3).publicar(1);
    const [job] = await fila.getWaiting();
    expect(job.id).toBe('doc-1');
  });

  // Importa para a reconciliacao futura, que republica sem saber se o job
  // ainda existe.
  it('publicar o mesmo documento duas vezes nao cria trabalho duplicado', async () => {
    const publicador = new PublicadorBullMq(fila, 3);
    await publicador.publicar(7);
    await publicador.publicar(7);

    expect(await fila.getWaitingCount()).toBe(1);
  });
});
