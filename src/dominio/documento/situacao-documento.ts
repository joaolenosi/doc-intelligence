import { ErroDeDominio } from '../comum/erro-de-dominio';

/**
 * O ciclo de vida do documento.
 *
 * Os valores ficam em ingles porque sao contrato exposto, e o mesmo conjunto
 * esta no CHECK da coluna doc_situacao. Banco e dominio impondo a mesma regra
 * nao e redundancia: o dominio da a mensagem boa, o banco garante que nenhum
 * caminho que esqueca do dominio grave lixo.
 */
export enum SituacaoDocumento {
  RECEIVED = 'RECEIVED',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  REVIEW_REQUIRED = 'REVIEW_REQUIRED',
  FAILED = 'FAILED',
  REJECTED = 'REJECTED',
}

/**
 * Transicoes validas, e so estas.
 *
 * PROCESSING para PROCESSING existe porque falha transitoria devolve o trabalho
 * para a fila sem mudar a situacao, e o contador de tentativas sobe. Sem essa
 * entrada, a retentativa do fato (a) precisaria de um estado intermediario que
 * nao significa nada para quem consome.
 *
 * REVIEW_REQUIRED e terminal nesta fatia. Deixa de ser quando a conferencia
 * humana existir, com IN_REVIEW entrando entre ele e PROCESSED. Modelar isso
 * agora seria modelar um fluxo que ninguem escreveu.
 */
const TRANSICOES: Readonly<Record<SituacaoDocumento, readonly SituacaoDocumento[]>> = {
  [SituacaoDocumento.RECEIVED]: [SituacaoDocumento.PROCESSING, SituacaoDocumento.REJECTED],
  [SituacaoDocumento.PROCESSING]: [
    SituacaoDocumento.PROCESSING,
    SituacaoDocumento.PROCESSED,
    SituacaoDocumento.REVIEW_REQUIRED,
    SituacaoDocumento.FAILED,
  ],
  [SituacaoDocumento.PROCESSED]: [],
  [SituacaoDocumento.REVIEW_REQUIRED]: [],
  [SituacaoDocumento.FAILED]: [],
  [SituacaoDocumento.REJECTED]: [],
};

/** Situacoes que exigem motivo registrado, espelhando ck_doc_motivos_coerentes. */
export const EXIGE_MOTIVO: readonly SituacaoDocumento[] = [SituacaoDocumento.REVIEW_REQUIRED];

export function ehTerminal(situacao: SituacaoDocumento): boolean {
  return TRANSICOES[situacao].length === 0;
}

export function podeTransitar(de: SituacaoDocumento, para: SituacaoDocumento): boolean {
  return TRANSICOES[de].includes(para);
}

/**
 * Falha alto em vez de ignorar. Situacao errada no banco e um bug que so
 * aparece dias depois, num relatorio que nao fecha, e ai ninguem sabe qual
 * caminho a produziu.
 */
export function garantirTransicao(de: SituacaoDocumento, para: SituacaoDocumento): void {
  if (!podeTransitar(de, para)) {
    throw new ErroDeDominio(
      `Transicao invalida de ${de} para ${para}`,
      'TRANSICAO_INVALIDA',
    );
  }
}
