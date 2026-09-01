import { Worker } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import { ProcessarDocumento } from '../../../aplicacao/casos-de-uso/processar-documento.caso-de-uso';
import { FILA_DE_PROCESSAMENTO } from '../nome-da-fila';

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
    { connection: entrada.conexao, concurrency: entrada.concorrencia },
  );

  worker.on('failed', (job, erro) => {
    // Log sem conteudo de documento. Id, tentativa e codigo de erro bastam para
    // diagnosticar, e o valor extraido nunca entra aqui. Fato (d).
    console.error(
      JSON.stringify({
        evento: 'trabalho_falhou',
        documentoId: job?.data?.documentoId,
        tentativa: job?.attemptsMade,
        erro: erro.name,
        codigo: (erro as { codigo?: string }).codigo,
      }),
    );
  });

  return worker;
}
