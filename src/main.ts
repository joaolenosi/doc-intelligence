import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { carregarConfiguracao } from './infraestrutura/config/configuracao';
import { ApiModule } from './infraestrutura/modulos/api.module';
import { dataSource } from './infraestrutura/persistencia/typeorm/data-source';

/**
 * O processo da API.
 *
 * Ele nao processa documento. Recebe, grava, publica e responde, e o worker faz
 * o resto. Separar os dois em processos e a prova executavel do ADR-003: com
 * tudo no mesmo processo, "o processamento nao depende do ciclo da requisicao"
 * e uma afirmacao que ninguem consegue verificar.
 */
async function subir(): Promise<void> {
  const configuracao = carregarConfiguracao();
  await dataSource.initialize();

  // Migrations rodam na subida da API, e nao do worker: dois workers subindo
  // juntos disputariam a mesma migration.
  await dataSource.runMigrations();

  const app = await NestFactory.create(ApiModule.registrar(configuracao, dataSource), {
    // O logger padrao do Nest imprime a requisicao inteira em alguns caminhos
    // de erro. Aqui a resposta de erro passa pelo FiltroDeErro, que ja escolhe
    // o que sai, e o resto fica em warn para cima. Fato (d).
    logger: ['error', 'warn', 'log'],
  });

  const porta = Number(process.env.PORTA ?? 3000);
  await app.listen(porta);

  console.log(
    JSON.stringify({
      evento: 'api_no_ar',
      porta,
      filaAdaptador: configuracao.fila.adaptador,
      modoDoDuble: configuracao.extrator.modoDoDuble,
    }),
  );
}

subir().catch((erro) => {
  console.error(JSON.stringify({ evento: 'api_nao_subiu', erro: (erro as Error).message }));
  process.exit(1);
});
