import 'reflect-metadata';
import { Worker } from 'bullmq';
import { carregarConfiguracao } from './infraestrutura/config/configuracao';
import { criarConsumidorBullMq } from './infraestrutura/fila/bullmq/consumidor-bullmq';
import { ConsumidorPostgres } from './infraestrutura/fila/postgres/consumidor-postgres';
import { compor } from './infraestrutura/modulos/composicao';
import { dataSource } from './infraestrutura/persistencia/typeorm/data-source';

/**
 * O processo que chama o modelo.
 *
 * Nao usa Nest: ele nao serve HTTP, e subir um container de injecao para
 * instanciar tres objetos que ja se instanciam com `new` seria carregar o
 * framework sem receber nada em troca. E o retorno concreto do ADR-002.
 *
 * O adaptador de fila vem de FILA_ADAPTADOR. Derrubar o Redis com
 * FILA_ADAPTADOR=postgres e ver o fluxo continuar e a demonstracao do ADR-004.
 */
async function subir(): Promise<void> {
  const configuracao = carregarConfiguracao();
  await dataSource.initialize();

  const dependencias = compor({ configuracao, dataSource });

  let encerrar: () => Promise<void>;

  if (configuracao.fila.adaptador === 'bullmq') {
    const worker: Worker = criarConsumidorBullMq({
      conexao: { host: configuracao.fila.redisHost, port: configuracao.fila.redisPorta },
      concorrencia: configuracao.fila.concorrencia,
      processar: dependencias.processar,
    });
    encerrar = async () => {
      await worker.close();
    };
  } else {
    const consumidor = new ConsumidorPostgres({
      dataSource,
      processar: dependencias.processar,
      concorrencia: configuracao.fila.concorrencia,
      maxTentativas: configuracao.extrator.maxTentativas,
    });
    consumidor.iniciar();
    encerrar = () => consumidor.parar();
  }

  console.log(
    JSON.stringify({
      evento: 'worker_no_ar',
      filaAdaptador: configuracao.fila.adaptador,
      concorrencia: configuracao.fila.concorrencia,
      modoDoDuble: configuracao.extrator.modoDoDuble,
    }),
  );

  // Encerramento limpo. Sem isso, um deploy no meio do pico mata o processo com
  // uma chamada ao fornecedor em voo, e aquela chamada foi paga e perdida.
  const desligar = async (sinal: string) => {
    console.log(JSON.stringify({ evento: 'worker_encerrando', sinal }));
    await encerrar();
    if (dependencias.filaBullMq !== undefined) await dependencias.filaBullMq.close();
    await dataSource.destroy();
    process.exit(0);
  };
  process.on('SIGTERM', () => void desligar('SIGTERM'));
  process.on('SIGINT', () => void desligar('SIGINT'));
}

subir().catch((erro) => {
  console.error(JSON.stringify({ evento: 'worker_nao_subiu', erro: (erro as Error).message }));
  process.exit(1);
});
