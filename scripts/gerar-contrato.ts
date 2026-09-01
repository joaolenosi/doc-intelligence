import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { montarContrato } from '../src/infraestrutura/http/documentacao';
import { Configuracao } from '../src/infraestrutura/config/configuracao';
import { ApiModule } from '../src/infraestrutura/modulos/api.module';

/**
 * Grava o contrato a partir da propria aplicacao.
 *
 * Gerado, e nao escrito a mao, porque contrato escrito a mao diverge do codigo
 * na terceira alteracao. Versionado no repositorio por dois motivos: quem for
 * avaliar le o contrato sem subir nada, e qualquer mudanca acidental na forma
 * da resposta aparece como diferenca no controle de versao em vez de passar
 * despercebida.
 *
 * Nao sobe servidor, nao conecta no banco e nao fala com o Redis. A fonte de
 * dados e criada e nunca inicializada, porque os repositorios so consultam sob
 * demanda, e o adaptador de fila e o de Postgres justamente para nao abrir
 * conexao com o Redis so para gerar um JSON.
 */
const DESTINO = join(__dirname, '..', 'docs', 'contrato-openapi.json');

const configuracaoParaGeracao: Configuracao = {
  banco: { host: 'localhost', porta: 5432, usuario: 'doc', senha: 'doc', base: 'doc_intelligence' },
  fila: { adaptador: 'postgres', concorrencia: 1, redisHost: 'localhost', redisPorta: 6379 },
  extrator: { modoDoDuble: 'SUCESSO', timeoutMs: 60_000, maxTentativas: 3 },
  confianca: { limiarTipo: 0.8, limiarCampo: 0.85 },
  upload: { tamanhoMaximoBytes: 26_214_400 },
  armazenamento: { diretorio: './storage' },
  documentacao: { habilitada: false },
  apiKey: 'geracao-de-contrato',
};

export async function gerarContrato(): Promise<Record<string, unknown>> {
  const dataSource = new DataSource({
    type: 'postgres',
    host: configuracaoParaGeracao.banco.host,
    port: configuracaoParaGeracao.banco.porta,
    username: configuracaoParaGeracao.banco.usuario,
    password: configuracaoParaGeracao.banco.senha,
    database: configuracaoParaGeracao.banco.base,
    synchronize: false,
  });

  const app = await NestFactory.create(
    ApiModule.registrar(configuracaoParaGeracao, dataSource),
    { logger: false },
  );
  await app.init();
  const contrato = montarContrato(app);
  await app.close();
  return contrato as unknown as Record<string, unknown>;
}

if (require.main === module) {
  gerarContrato()
    .then((contrato) => {
      // Duas espacos e quebra de linha no fim para o diff ficar legivel: um
      // JSON numa linha so transformaria qualquer mudanca num diff inutil.
      writeFileSync(DESTINO, `${JSON.stringify(contrato, null, 2)}\n`, 'utf8');
      console.log(`contrato gravado em ${DESTINO}`);
      process.exit(0);
    })
    .catch((erro) => {
      console.error(erro);
      process.exit(1);
    });
}
