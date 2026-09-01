import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { registrarFalha } from './infraestrutura/comum/descrever-erro';
import { carregarConfiguracao } from './infraestrutura/config/configuracao';
import { CAMINHO_DA_DOCUMENTACAO, publicarDocumentacao } from './infraestrutura/http/documentacao';
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

  // A raiz continua em 404, de proposito: nao existe rota nem redirecionamento
  // ali. Quem sobe o projeto acha o caminho pelo log e pelo README.
  if (configuracao.documentacao.habilitada) publicarDocumentacao(app);

  const porta = Number(process.env.PORTA ?? 3000);
  await app.listen(porta);

  console.log(
    JSON.stringify({
      evento: 'api_no_ar',
      porta,
      filaAdaptador: configuracao.fila.adaptador,
      modoDoDuble: configuracao.extrator.modoDoDuble,
      // Impresso na subida porque `localhost:3000` responde 404 e ninguem
      // adivinha para onde ir.
      documentacao: configuracao.documentacao.habilitada
        ? `http://localhost:${porta}/${CAMINHO_DA_DOCUMENTACAO}`
        : 'desabilitada (DOCS_HABILITADO=true para publicar)',
    }),
  );
}

subir().catch((erro) => {
  registrarFalha('api_nao_subiu', erro);
  process.exit(1);
});
