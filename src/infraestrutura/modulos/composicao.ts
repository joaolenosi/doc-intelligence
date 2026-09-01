import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { ConsultarDocumento } from '../../aplicacao/casos-de-uso/consultar-documento.caso-de-uso';
import { ProcessarDocumento } from '../../aplicacao/casos-de-uso/processar-documento.caso-de-uso';
import { ReceberDocumento } from '../../aplicacao/casos-de-uso/receber-documento.caso-de-uso';
import { PublicadorDeProcessamento } from '../../aplicacao/portas/publicador-de-processamento.porta';
import { Confianca } from '../../dominio/documento/confianca.vo';
import { PoliticaDeConfianca } from '../../dominio/documento/politica-de-confianca';
import { PoliticaDeNomenclatura } from '../../dominio/documento/politica-de-nomenclatura';
import { ArmazenamentoEmDisco } from '../armazenamento/armazenamento-em-disco.adapter';
import { CalculadoraSha256 } from '../comum/calculadora-sha256.adapter';
import { RelogioDoSistema } from '../comum/relogio-do-sistema.adapter';
import { Configuracao } from '../config/configuracao';
import { PublicadorBullMq } from '../fila/bullmq/publicador-bullmq.adapter';
import { FILA_DE_PROCESSAMENTO } from '../fila/nome-da-fila';
import { PublicadorPostgres } from '../fila/postgres/publicador-postgres.adapter';
import { ExtratorDuble } from '../ia/duble/extrator-duble.adapter';
import { ExtratorComTimeout } from '../ia/extrator-com-timeout.adapter';
import { InspetorMagicBytes } from '../inspecao/inspetor-magic-bytes.adapter';
import { UnidadeDeTrabalhoTypeOrm } from '../persistencia/typeorm/contexto-transacional';
import { RegistroDeAuditoriaTypeOrm } from '../persistencia/typeorm/repositorios/auditoria.repositorio';
import { CatalogoDeTiposTypeOrm } from '../persistencia/typeorm/repositorios/catalogo.repositorio';
import { RepositorioDeDocumentoTypeOrm } from '../persistencia/typeorm/repositorios/documento.repositorio';
import { RegistroDeProcessamentoTypeOrm } from '../persistencia/typeorm/repositorios/processamento.repositorio';
import { RepositorioDeSubmissaoTypeOrm } from '../persistencia/typeorm/repositorios/submissao.repositorio';

/**
 * A composicao, escrita a mao.
 *
 * E aqui que o custo do ADR-002 aparece inteiro: nenhum caso de uso tem
 * decorator, entao ninguem monta ninguem sozinho. Em troca, cada um deles se
 * instancia com `new` num teste, sem container, e e por isso que os testes de
 * aplicacao rodam em milissegundos e sem banco.
 *
 * Este arquivo tambem e onde a troca de peca acontece de verdade: mudar
 * FILA_ADAPTADOR troca o publicador e nada mais precisa saber.
 */
export interface Dependencias {
  readonly receber: ReceberDocumento;
  readonly processar: ProcessarDocumento;
  readonly consultar: ConsultarDocumento;
  readonly publicador: PublicadorDeProcessamento;
  readonly filaBullMq?: Queue;
}

export function compor(entrada: {
  configuracao: Configuracao;
  dataSource: DataSource;
}): Dependencias {
  const { configuracao: config, dataSource } = entrada;

  const relogio = new RelogioDoSistema();
  const documentos = new RepositorioDeDocumentoTypeOrm(dataSource, relogio);
  const submissoes = new RepositorioDeSubmissaoTypeOrm(dataSource);
  const processamentos = new RegistroDeProcessamentoTypeOrm(dataSource, relogio);
  const auditoria = new RegistroDeAuditoriaTypeOrm(dataSource, relogio);
  const catalogo = new CatalogoDeTiposTypeOrm(dataSource);
  const unidadeDeTrabalho = new UnidadeDeTrabalhoTypeOrm(dataSource);
  const armazenamento = new ArmazenamentoEmDisco(config.armazenamento.diretorio);

  // A escolha do adaptador de fila. Os dois sao reais, e derrubar o Redis com
  // FILA_ADAPTADOR=postgres e a demonstracao do ADR-004.
  let filaBullMq: Queue | undefined;
  let publicador: PublicadorDeProcessamento;
  if (config.fila.adaptador === 'bullmq') {
    filaBullMq = new Queue(FILA_DE_PROCESSAMENTO, {
      connection: { host: config.fila.redisHost, port: config.fila.redisPorta },
    });
    publicador = new PublicadorBullMq(filaBullMq, config.extrator.maxTentativas);
  } else {
    publicador = new PublicadorPostgres(dataSource);
  }

  // O timeout envolve o extrator, e nao mora dentro dele, para o mesmo limite
  // valer para o fornecedor que vier depois. Ver ADR-005.
  const extrator = new ExtratorComTimeout(
    new ExtratorDuble({ modo: config.extrator.modoDoDuble }),
    config.extrator.timeoutMs,
  );

  return {
    filaBullMq,
    publicador,
    receber: new ReceberDocumento({
      documentos,
      submissoes,
      armazenamento,
      inspetor: new InspetorMagicBytes(),
      hash: new CalculadoraSha256(),
      publicador,
      unidadeDeTrabalho,
      relogio,
      configuracao: { tamanhoMaximoBytes: config.upload.tamanhoMaximoBytes },
    }),
    processar: new ProcessarDocumento({
      documentos,
      processamentos,
      auditoria,
      catalogo,
      armazenamento,
      extrator,
      politicaDeConfianca: new PoliticaDeConfianca({
        tipo: Confianca.de(config.confianca.limiarTipo),
        campo: Confianca.de(config.confianca.limiarCampo),
      }),
      politicaDeNomenclatura: new PoliticaDeNomenclatura(),
      relogio,
      configuracao: { maxTentativas: config.extrator.maxTentativas },
    }),
    consultar: new ConsultarDocumento({ documentos, submissoes, processamentos }),
  };
}
