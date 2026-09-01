import type { Queue } from 'bullmq';
import { PublicadorBullMq } from '../../src/infraestrutura/fila/bullmq/publicador-bullmq.adapter';

/**
 * Roda sem Redis, de proposito.
 *
 * O bug do identificador numerico so apareceu quando o ambiente inteiro subiu:
 * o BullMQ recusa id customizado que pareca inteiro, e todo upload respondia
 * 500. O teste que existia para isso dependia de Redis, entao nao protegia no
 * dia a dia, que e quando a regressao aconteceria.
 *
 * Aqui a regra do BullMQ vira assercao contra uma fila de mentira. Se alguem
 * voltar a usar o id do documento direto, este teste falha no `npm test`, sem
 * subir nada.
 */
interface OpcoesPublicadas {
  jobId?: string;
  attempts?: number;
  backoff?: { type: string; delay?: number };
}

const filaFalsa = () => {
  const chamadas: { nome: string; dados: unknown; opcoes: OpcoesPublicadas }[] = [];
  const fila = {
    add: async (nome: string, dados: unknown, opcoes: OpcoesPublicadas) => {
      chamadas.push({ nome, dados, opcoes });
      return { id: opcoes.jobId };
    },
  } as unknown as Queue;
  return { fila, chamadas };
};

describe('PublicadorBullMq', () => {
  it('publica o id do documento no payload', async () => {
    const { fila, chamadas } = filaFalsa();
    await new PublicadorBullMq(fila, 3).publicar(42);

    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].dados).toEqual({ documentoId: 42 });
    expect(chamadas[0].opcoes.attempts).toBe(3);
  });

  /**
   * O publicador so nomeia a estrategia de espera. A funcao mora nas `settings`
   * do worker, em `criarConsumidorBullMq`, porque e onde o BullMQ a aceita.
   *
   * Os dois lados precisam concordar neste nome, pelo mesmo motivo que precisam
   * concordar no nome da fila, e a diferenca e que a fila esta numa constante
   * compartilhada e este nome nao pode estar: quem publica passa uma string e
   * quem consome passa uma funcao. Como nao da para compartilhar o valor, sobra
   * afirma-lo aqui.
   *
   * Antes disto o publicador pedia `exponential` com delay de 2000, e o jitter
   * que o adaptador de Postgres tinha nao valia para o caminho padrao.
   */
  it('pede a estrategia de espera customizada, e nao a nativa', async () => {
    const { fila, chamadas } = filaFalsa();
    await new PublicadorBullMq(fila, 3).publicar(42);

    expect(chamadas[0].opcoes.backoff).toEqual({ type: 'custom' });
    // A ausencia de `delay` e parte da assercao: com a estrategia customizada
    // quem decide a espera e a funcao registrada no worker, e um `delay` aqui
    // seria um numero sem efeito parecendo configuracao.
    expect(chamadas[0].opcoes.backoff?.delay).toBeUndefined();
  });

  /**
   * A regra do BullMQ, escrita como assercao: id customizado que pareca inteiro
   * e recusado em tempo de execucao, e o sintoma e 500 em todo upload.
   */
  it('nao usa identificador que pareca inteiro', async () => {
    const { fila, chamadas } = filaFalsa();
    await new PublicadorBullMq(fila, 3).publicar(1);

    const id = chamadas[0].opcoes.jobId as string;
    expect(Number.isNaN(Number(id))).toBe(true);
    expect(id).toBe('doc-1');
  });

  /**
   * O identificador continua derivando do documento, um para um. E o que
   * preserva a deduplicacao do BullMQ: republicar o mesmo documento nao cria
   * trabalho duplicado, e a reconciliacao futura vai republicar sem saber se o
   * job ainda existe.
   */
  it('deriva o identificador do documento, de forma estavel', async () => {
    const { fila, chamadas } = filaFalsa();
    const publicador = new PublicadorBullMq(fila, 3);

    await publicador.publicar(7);
    await publicador.publicar(7);
    await publicador.publicar(8);

    expect(chamadas.map((c) => c.opcoes.jobId)).toEqual(['doc-7', 'doc-7', 'doc-8']);
    // Documentos diferentes nunca colidem, e o mesmo documento sempre colide,
    // que e exatamente o comportamento que a deduplicacao precisa.
    expect(new Set(chamadas.map((c) => c.opcoes.jobId)).size).toBe(2);
  });
});
