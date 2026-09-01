import { Worker } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import { ProcessarDocumento } from '../../../aplicacao/casos-de-uso/processar-documento.caso-de-uso';
import { registrarFalha } from '../../comum/descrever-erro';
import { FILA_DE_PROCESSAMENTO, esperaAntesDeRetentar } from '../nome-da-fila';

/**
 * Consome a fila do Redis e chama o caso de uso.
 *
 * O consumo e iniciativa da infraestrutura de proposito: a porta que a
 * aplicacao conhece so sabe publicar. Se ela tivesse os dois lados, a aplicacao
 * passaria a conhecer o ciclo de vida do consumidor.
 *
 * A concorrencia vem de configuracao e o padrao e 5, que sai da conta do pico:
 * 800 documentos em 2h dao 0,11 por segundo, e a 40s de pior caso isso exige
 * 4,4 execucoes simultaneas.
 *
 * A espera entre tentativas tambem e registrada aqui, e nao em quem publica,
 * porque e onde o BullMQ a aceita. E a mesma funcao que o adaptador de Postgres
 * usa, para os dois caminhos falharem do mesmo jeito.
 */
export function criarConsumidorBullMq(entrada: {
  conexao: ConnectionOptions;
  concorrencia: number;
  processar: ProcessarDocumento;
}): Worker {
  const worker = new Worker(
    FILA_DE_PROCESSAMENTO,
    async (job) => {
      await entrada.processar.executar(Number(job.data.documentoId));
    },
    {
      connection: entrada.conexao,
      concurrency: entrada.concorrencia,
      settings: {
        // O publicador pede `backoff: { type: 'custom' }` e a funcao mora aqui,
        // porque e assim que o BullMQ divide as duas coisas. `attemptsMade` ja
        // conta a tentativa que acabou de falhar, que e o mesmo significado do
        // parametro de `esperaAntesDeRetentar`, entao um vai direto no outro.
        backoffStrategy: (attemptsMade: number) => esperaAntesDeRetentar(attemptsMade),
      },
    },
  );

  worker.on('failed', (job, erro) => {
    // Log sem conteudo de documento. Id, tentativa e codigo bastam para
    // diagnosticar, e quem decide o que do erro pode sair e `registrarFalha`.
    registrarFalha('trabalho_falhou', erro, {
      documentoId: job?.data?.documentoId,
      tentativa: job?.attemptsMade,
    });
  });

  return worker;
}
