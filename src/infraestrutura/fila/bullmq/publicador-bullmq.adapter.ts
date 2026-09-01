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
        // O id do job e o do documento, entao republicar o mesmo documento nao
        // cria trabalho duplicado. Importa para a reconciliacao futura, que vai
        // republicar sem saber se o job ainda existe.
        jobId: String(documentoId),
        attempts: this.maxTentativas,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: false,
      },
    );
  }
}
