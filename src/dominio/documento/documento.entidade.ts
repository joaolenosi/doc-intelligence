import { ErroDeDominio } from '../comum/erro-de-dominio';
import { ChaveArmazenamento } from './chave-armazenamento.vo';
import { Confianca } from './confianca.vo';
import { HashConteudo } from './hash-conteudo.vo';
import { MotivoDeRevisao } from './motivo-de-revisao';
import { MotivoRegistrado } from './motivo-registrado';
import { DecisaoDeConfianca } from './politica-de-confianca';
import { ResultadoDaNomenclatura } from './politica-de-nomenclatura';
import { SituacaoDocumento, garantirTransicao } from './situacao-documento';
import { TipoDocumento } from './tipo-documento';

/**
 * O documento, identificado pelo conteudo.
 *
 * Dois envios do mesmo arquivo sao o mesmo documento, por causa do fato (c),
 * e cada envio vira uma Submissao. O nome que veio do celular nao mora aqui.
 *
 * A entidade e dona de duas invariantes que o banco tambem impoe, e a
 * duplicacao e proposital: o dominio da a mensagem boa e falha cedo, o banco
 * garante que nenhum caminho que esqueca do dominio grave lixo.
 *
 * Primeira: so muda de situacao por transicao valida.
 * Segunda: motivo de revisao existe se e so se a situacao e REVIEW_REQUIRED,
 * que e o que ck_doc_motivos_coerentes tambem exige.
 */
export class Documento {
  private constructor(
    readonly hash: HashConteudo,
    readonly chaveArmazenamento: ChaveArmazenamento,
    readonly tipoMidia: string,
    readonly tamanhoBytes: number,
    private estadoSituacao: SituacaoDocumento,
    readonly criadoEm: Date,
    private estadoAtualizadoEm: Date,
    private estadoMotivos: readonly MotivoRegistrado[] = [],
    private estadoTipo?: TipoDocumento,
    private estadoConfiancaTipo?: Confianca,
    private estadoNomeSugerido?: string,
    private estadoProcessadoEm?: Date,
    readonly versao: number = 1,
    readonly id?: number,
  ) {}

  get situacao(): SituacaoDocumento {
    return this.estadoSituacao;
  }
  get motivosRevisao(): readonly MotivoRegistrado[] {
    return this.estadoMotivos;
  }
  get tipo(): TipoDocumento | undefined {
    return this.estadoTipo;
  }
  get confiancaTipo(): Confianca | undefined {
    return this.estadoConfiancaTipo;
  }
  get nomeSugerido(): string | undefined {
    return this.estadoNomeSugerido;
  }
  get processadoEm(): Date | undefined {
    return this.estadoProcessadoEm;
  }
  get atualizadoEm(): Date {
    return this.estadoAtualizadoEm;
  }

  static receber(entrada: {
    hash: HashConteudo;
    chaveArmazenamento: ChaveArmazenamento;
    tipoMidia: string;
    tamanhoBytes: number;
    agora: Date;
  }): Documento {
    if (!Number.isInteger(entrada.tamanhoBytes) || entrada.tamanhoBytes <= 0) {
      throw new ErroDeDominio('Documento sem conteudo', 'TAMANHO_INVALIDO');
    }
    return new Documento(
      entrada.hash,
      entrada.chaveArmazenamento,
      entrada.tipoMidia,
      entrada.tamanhoBytes,
      SituacaoDocumento.RECEIVED,
      entrada.agora,
      entrada.agora,
    );
  }

  private transitar(para: SituacaoDocumento, agora: Date): void {
    garantirTransicao(this.estadoSituacao, para);
    this.estadoSituacao = para;
    this.estadoAtualizadoEm = agora;
  }

  /** Reprovou na validacao. Nenhuma chamada ao modelo foi paga. */
  rejeitar(agora: Date): void {
    this.transitar(SituacaoDocumento.REJECTED, agora);
  }

  iniciarProcessamento(agora: Date): void {
    this.transitar(SituacaoDocumento.PROCESSING, agora);
  }

  /**
   * Falha transitoria devolve o trabalho para a fila sem mudar a situacao. A
   * contagem de tentativas nao mora aqui: cada tentativa e uma linha em
   * `processamento`, com provedor, modelo, duracao e custo. Ver ADR-011.
   */
  registrarFalhaTransitoria(agora: Date): void {
    this.transitar(SituacaoDocumento.PROCESSING, agora);
  }

  /** Tentativas esgotadas, ou falha permanente do extrator. */
  falhar(agora: Date): void {
    this.transitar(SituacaoDocumento.FAILED, agora);
  }

  /**
   * Junta as duas regras que decidem se o resultado entra como pronto.
   *
   * A politica de confianca responde se o modelo confiou no que produziu. A
   * politica de nomenclatura responde se da para montar o nome. As duas quase
   * sempre concordam, porque o template so referencia campo obrigatorio e campo
   * obrigatorio ausente ja para o documento. Elas divergem no unico caso em que
   * o campo veio, com confianca alta, e o valor nao sobreviveu a normalizacao.
   *
   * Nome incompleto nao e gerado: um nome com buraco seria adotado por quem
   * consome sem ninguem notar.
   */
  concluirExtracao(entrada: {
    tipo: TipoDocumento;
    confiancaTipo: Confianca;
    decisao: DecisaoDeConfianca;
    nome: ResultadoDaNomenclatura;
    agora: Date;
  }): void {
    const motivos = [...entrada.decisao.motivos];
    if (!entrada.nome.montou) {
      for (const marcador of entrada.nome.marcadoresSemValor) {
        motivos.push(MotivoRegistrado.doCampo(MotivoDeRevisao.NOME_INCOMPLETO, marcador));
      }
    }

    const situacao =
      motivos.length === 0 ? SituacaoDocumento.PROCESSED : SituacaoDocumento.REVIEW_REQUIRED;
    this.transitar(situacao, entrada.agora);

    this.estadoTipo = entrada.tipo;
    this.estadoConfiancaTipo = entrada.confiancaTipo;
    this.estadoMotivos = motivos;
    this.estadoNomeSugerido = entrada.nome.montou ? entrada.nome.nome : undefined;
    this.estadoProcessadoEm = entrada.agora;

    this.garantirInvariantes();
  }

  private garantirInvariantes(): void {
    const exigeMotivo = this.estadoSituacao === SituacaoDocumento.REVIEW_REQUIRED;
    const temMotivo = this.estadoMotivos.length > 0;
    if (exigeMotivo !== temMotivo) {
      throw new ErroDeDominio(
        `Situacao ${this.estadoSituacao} e motivos de revisao incoerentes`,
        'MOTIVOS_INCOERENTES',
      );
    }
    // Documento pronto sem nome seria o servico entregando meia resposta: o
    // nome padronizado e o comportamento 2 do produto.
    if (this.estadoSituacao === SituacaoDocumento.PROCESSED && this.estadoNomeSugerido === undefined) {
      throw new ErroDeDominio(
        'Documento processado precisa ter nome sugerido',
        'PROCESSADO_SEM_NOME',
      );
    }
  }

  /** Os motivos como o banco e o GET os recebem. */
  motivosParaTexto(): string[] {
    return this.estadoMotivos.map((motivo) => motivo.paraTexto());
  }

  /**
   * Fato (d). O nome sugerido carrega nome de pessoa e numero de documento,
   * apesar de parecer identificador tecnico, entao nao sai daqui por descuido
   * de interpolacao. Ver ADR-012.
   */
  toString(): string {
    return `Documento(${this.id ?? 'novo'}, ${this.estadoSituacao})`;
  }

  static reconstituir(estado: {
    id: number;
    hash: HashConteudo;
    chaveArmazenamento: ChaveArmazenamento;
    tipoMidia: string;
    tamanhoBytes: number;
    situacao: SituacaoDocumento;
    criadoEm: Date;
    atualizadoEm: Date;
    versao: number;
    motivosRevisao?: readonly MotivoRegistrado[];
    tipo?: TipoDocumento;
    confiancaTipo?: Confianca;
    nomeSugerido?: string;
    processadoEm?: Date;
  }): Documento {
    return new Documento(
      estado.hash,
      estado.chaveArmazenamento,
      estado.tipoMidia,
      estado.tamanhoBytes,
      estado.situacao,
      estado.criadoEm,
      estado.atualizadoEm,
      estado.motivosRevisao ?? [],
      estado.tipo,
      estado.confiancaTipo,
      estado.nomeSugerido,
      estado.processadoEm,
      estado.versao,
      estado.id,
    );
  }
}
