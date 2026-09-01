import { CampoExtraido } from '../../dominio/documento/campo-extraido.entidade';
import { Confianca } from '../../dominio/documento/confianca.vo';
import { Documento } from '../../dominio/documento/documento.entidade';
import { PoliticaDeConfianca } from '../../dominio/documento/politica-de-confianca';
import { PoliticaDeNomenclatura } from '../../dominio/documento/politica-de-nomenclatura';
import { SituacaoDocumento, ehTerminal } from '../../dominio/documento/situacao-documento';
import { TipoDocumento } from '../../dominio/documento/tipo-documento';
import { extensaoDe } from '../../dominio/documento/tipo-midia';
import {
  DocumentoNaoEncontrado,
  FalhaPermanenteDoExtrator,
  FalhaTransitoriaDoExtrator,
} from '../erros/erros-de-aplicacao';
import { ArmazenamentoDeArquivo } from '../portas/armazenamento-de-arquivo.porta';
import { CatalogoDeTipos } from '../portas/catalogo-de-tipos.porta';
import {
  ExtratorDeDocumento,
  ResultadoDaExtracao,
} from '../portas/extrator-de-documento.porta';
import { RegistroDeAuditoria } from '../portas/registro-de-auditoria.porta';
import { RegistroDeProcessamento } from '../portas/registro-de-processamento.porta';
import { Relogio } from '../portas/relogio.porta';
import { RepositorioDeDocumento } from '../portas/repositorio-de-documento.porta';

export interface ConfiguracaoDeProcessamento {
  readonly maxTentativas: number;
}

export interface DependenciasDeProcessamento {
  readonly documentos: RepositorioDeDocumento;
  readonly processamentos: RegistroDeProcessamento;
  readonly auditoria: RegistroDeAuditoria;
  readonly catalogo: CatalogoDeTipos;
  readonly armazenamento: ArmazenamentoDeArquivo;
  readonly extrator: ExtratorDeDocumento;
  readonly politicaDeConfianca: PoliticaDeConfianca;
  readonly politicaDeNomenclatura: PoliticaDeNomenclatura;
  readonly relogio: Relogio;
  readonly configuracao: ConfiguracaoDeProcessamento;
}

/**
 * Chama o modelo e grava o resultado.
 *
 * O que este caso de uso sabe sobre retry e so o que e regra de negocio ligada
 * a custo: distinguir falha transitoria de permanente, e que existe um teto de
 * tentativas. Quanto tempo esperar e quantos trabalhos rodam em paralelo sao
 * configuracao do adaptador de fila. Ver ADR-004 e ADR-005.
 *
 * Quando a falha e transitoria e ainda ha tentativa, ele relanca, e quem
 * reagenda e o adaptador. Quando o teto acaba, ele nao relanca: o documento
 * termina em FAILED e o trabalho esta concluido, porque insistir custaria
 * dinheiro sem mudar o resultado.
 */
export class ProcessarDocumento {
  constructor(private readonly deps: DependenciasDeProcessamento) {}

  async executar(documentoId: number): Promise<void> {
    const documento = await this.deps.documentos.buscarPorId(documentoId);
    if (documento === undefined) throw new DocumentoNaoEncontrado(documentoId);

    // O mesmo trabalho pode ser entregue duas vezes: fila reentrega, e a
    // reconciliacao futura republica. Documento que ja terminou nao paga outra
    // chamada por causa disso.
    if (ehTerminal(documento.situacao)) return;

    if (documento.situacao === SituacaoDocumento.RECEIVED) {
      documento.iniciarProcessamento(this.deps.relogio.agora());
      await this.deps.documentos.atualizar(documento);
    }

    const tentativa = (await this.deps.processamentos.contarDoDocumento(documentoId)) + 1;
    const inicio = this.deps.relogio.agora();

    let resultado: ResultadoDaExtracao;
    let convertido: { campos: CampoExtraido[]; confiancaTipo: Confianca };
    try {
      const conteudo = await this.deps.armazenamento.ler(documento.chaveArmazenamento);
      resultado = await this.deps.extrator.extrair({
        conteudo,
        tipoMidia: documento.tipoMidia,
      });
      // A conversao fica dentro do try de proposito. Ela recusa confianca fora
      // da faixa, e isso e o fornecedor devolvendo dado malformado, nao a
      // extracao tendo dado certo. Se ficasse depois, a tentativa ja teria sido
      // gravada como sucesso e o documento ficaria preso em PROCESSING.
      convertido = this.converter(resultado);
    } catch (erro) {
      await this.tratarFalha(documento, tentativa, inicio, erro, resultado!);
      return;
    }

    await this.concluir(documento, tentativa, inicio, resultado, convertido);
  }

  private async tratarFalha(
    documento: Documento,
    tentativa: number,
    inicio: Date,
    erro: unknown,
    resultado?: ResultadoDaExtracao,
  ): Promise<void> {
    const transitoria = erro instanceof FalhaTransitoriaDoExtrator;
    const permanente = erro instanceof FalhaPermanenteDoExtrator;
    if (!transitoria && !permanente) throw erro;

    const agora = this.deps.relogio.agora();
    await this.deps.processamentos.registrar({
      documentoId: documento.id as number,
      tentativa,
      // Quando o fornecedor respondeu e o problema foi o conteudo da resposta,
      // ainda se sabe quem respondeu, e essa e a informacao que permite dizer
      // qual versao do modelo passou a devolver lixo.
      provedor: resultado?.provedor ?? 'desconhecido',
      modelo: resultado?.modelo ?? 'desconhecido',
      versaoPrompt: resultado?.versaoPrompt ?? 'desconhecido',
      sucesso: false,
      duracaoMs: agora.getTime() - inicio.getTime(),
      erroCodigo: (erro as { codigo: string }).codigo,
      // Mensagem tecnica. Nunca conteudo do documento. Fato (d).
      erroMensagem: (erro as Error).message,
    });

    const esgotou = tentativa >= this.deps.configuracao.maxTentativas;
    if (permanente || esgotou) {
      documento.falhar(agora);
      await this.deps.documentos.atualizar(documento);
      return;
    }

    documento.registrarFalhaTransitoria(agora);
    await this.deps.documentos.atualizar(documento);
    // Relanca para o adaptador reagendar com o backoff dele.
    throw erro;
  }

  private async concluir(
    documento: Documento,
    tentativa: number,
    inicio: Date,
    resultado: ResultadoDaExtracao,
    convertido: { campos: CampoExtraido[]; confiancaTipo: Confianca },
  ): Promise<void> {
    const agora = this.deps.relogio.agora();
    await this.deps.processamentos.registrar({
      documentoId: documento.id as number,
      tentativa,
      provedor: resultado.provedor,
      modelo: resultado.modelo,
      versaoPrompt: resultado.versaoPrompt,
      sucesso: true,
      duracaoMs: agora.getTime() - inicio.getTime(),
      custoEstimado: resultado.custoEstimado,
    });

    const tipo = await this.resolverTipo(resultado.tipoCodigo);
    const { campos, confiancaTipo } = convertido;

    const decisao = this.deps.politicaDeConfianca.decidir({ tipo, confiancaTipo, campos });
    const nome = this.deps.politicaDeNomenclatura.montar({
      tipo,
      campos,
      data: agora,
      extensao: extensaoDe(documento.tipoMidia),
    });

    documento.concluirExtracao({ tipo, confiancaTipo, decisao, nome, agora });
    await this.deps.documentos.atualizar(documento, campos);

    await this.deps.auditoria.registrar({
      documentoId: documento.id,
      acao: 'EXTRACAO_CONCLUIDA',
      ator: 'worker',
      // Nome de campo e contagem. Nunca valor, e nunca o nome sugerido.
      // Fato (d) e ADR-012.
      detalhe: {
        tipo: tipo.codigo,
        tentativa,
        situacao: documento.situacao,
        campos: campos.map((campo) => campo.nome),
        quantidadeDeCampos: campos.length,
        motivos: documento.motivosParaTexto(),
      },
    });
  }

  /** Tipo fora do catalogo vira DESCONHECIDO, e o documento para. */
  private async resolverTipo(codigo: string): Promise<TipoDocumento> {
    const tipo = await this.deps.catalogo.buscarPorCodigo(codigo);
    return tipo ?? (await this.deps.catalogo.desconhecido());
  }

  /**
   * Converte a saida crua do extrator para os tipos do dominio.
   *
   * Campo em branco e descartado em vez de recusado, porque campo em branco e
   * campo que nao veio, e a politica de confianca ja sabe reclamar de campo
   * obrigatorio ausente.
   *
   * Confianca fora da faixa e outra coisa: e o fornecedor devolvendo dado
   * malformado, e vira falha permanente. Retentar nao consertaria e custaria
   * mais duas chamadas.
   */
  private converter(resultado: ResultadoDaExtracao): {
    campos: CampoExtraido[];
    confiancaTipo: Confianca;
  } {
    try {
      const campos = resultado.campos
        .filter((campo) => campo.valor.trim().length > 0)
        .map((campo) => CampoExtraido.doModelo(campo.nome, campo.valor, Confianca.de(campo.confianca)));
      return { campos, confiancaTipo: Confianca.de(resultado.confiancaTipo) };
    } catch (erro) {
      throw new FalhaPermanenteDoExtrator(
        `Extrator devolveu resultado malformado: ${(erro as Error).message}`,
        'RESULTADO_MALFORMADO',
      );
    }
  }
}
