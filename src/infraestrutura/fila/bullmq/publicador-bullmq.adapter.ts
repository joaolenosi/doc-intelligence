import { Queue } from 'bullmq';
import { PublicadorDeProcessamento } from '../../../aplicacao/portas/publicador-de-processamento.porta';
import { FILA_DE_PROCESSAMENTO } from '../nome-da-fila';

/**
 * Publica o trabalho no Redis.
 *
 * Este e o adaptador padrao, e ele tem um defeito que eu prefiro deixar
 * escrito: o estado do documento fica no Postgres e o job fica no Redis, entao
 * nenhuma transacao alcanca os dois. Uma queda entre gravar o documento e
 * publicar deixa o documento parado em RECEIVED esperando um worker que nunca
 * vai pega-lo.
 *
 * A rotina de reconciliacao que fecha isso nao esta implementada e esta
 * desenhada em docs/escopo-nao-implementado.md. Com o adaptador de Postgres a
 * janela nao existe. Ver ADR-004.
 */
export class PublicadorBullMq implements PublicadorDeProcessamento {
  constructor(
    private readonly fila: Queue,
    private readonly maxTentativas: number,
  ) {}

  async publicar(documentoId: number): Promise<void> {
    await this.fila.add(
      FILA_DE_PROCESSAMENTO,
      { documentoId },
      {
        // O id do job deriva do id do documento, entao republicar o mesmo
        // documento nao cria trabalho duplicado. Importa para a reconciliacao
        // futura, que vai republicar sem saber se o job ainda existe.
        //
        // O prefixo nao e enfeite: o BullMQ recusa id customizado que pareca
        // inteiro, porque colidiria com a sequencia interna dele. Sem o
        // prefixo, todo upload responde 500 com "Custom Ids cannot be
        // integers", e o teste de integracao nao pegava isso porque rodava com
        // o adaptador de Postgres.
        jobId: `doc-${documentoId}`,
        attempts: this.maxTentativas,
        // A espera entre tentativas e a mesma do adaptador de Postgres, e vem
        // de `esperaAntesDeRetentar`. Aqui so cabe o nome da estrategia: o
        // BullMQ pede a funcao nas `settings` do worker, entao ela e registrada
        // em `criarConsumidorBullMq`. Publicador e consumidor precisam
        // concordar neste nome, pelo mesmo motivo que precisam concordar no
        // nome da fila.
        backoff: { type: 'custom' },
        removeOnComplete: { count: 1000 },
        removeOnFail: false,
      },
    );
  }
}
