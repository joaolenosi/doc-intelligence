/**
 * O tempo, como dependencia.
 *
 * A politica de nomenclatura usa data e a de retry usa tempo. Teste que depende
 * do relogio real e teste que falha sozinho de madrugada, e nome de arquivo que
 * depende do relogio real e nome que muda conforme a maquina.
 */
export interface Relogio {
  agora(): Date;
}
