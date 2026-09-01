/**
 * Por que um documento parou para conferencia humana.
 *
 * O estado REVIEW_REQUIRED sozinho diz que o documento parou e nao diz por que,
 * e "confianca baixa no tipo" e "faltou o numero da identidade" levam a
 * conferencias diferentes. Guardar o motivo e o que faz a fila de conferencia
 * ser priorizavel em vez de uma pilha indistinta.
 *
 * Sao codigos, e o detalhe que os acompanha e nome de campo. Nunca valor de
 * campo, por causa do fato (d): o motivo viaja para log e para resposta.
 */
export enum MotivoDeRevisao {
  CONFIANCA_TIPO_BAIXA = 'CONFIANCA_TIPO_BAIXA',
  CONFIANCA_CAMPO_BAIXA = 'CONFIANCA_CAMPO_BAIXA',
  CAMPO_OBRIGATORIO_AUSENTE = 'CAMPO_OBRIGATORIO_AUSENTE',
  NOME_INCOMPLETO = 'NOME_INCOMPLETO',
  TIPO_DESCONHECIDO = 'TIPO_DESCONHECIDO',
  CATALOGO_INVALIDO = 'CATALOGO_INVALIDO',
}
