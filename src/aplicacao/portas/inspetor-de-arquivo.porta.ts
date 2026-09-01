/**
 * Descobre o que o arquivo e, olhando os bytes.
 *
 * O fato (b) diz que nao existe validacao nenhuma do lado de quem envia, entao
 * nome, extensao e content-type informados sao metadado e nao entram em decisao
 * nenhuma. Um `.pdf` com bytes de JPEG e um JPEG.
 *
 * Devolve so o tipo de midia. A extensao sai dele, no dominio, porque guardar
 * as duas coisas criaria a chance de elas divergirem e a que vale e sempre a
 * que saiu dos bytes.
 *
 * Levanta ArquivoRecusado quando o conteudo nao e um dos tipos aceitos, antes
 * de o documento custar qualquer coisa.
 */
export interface InspetorDeArquivo {
  inspecionar(conteudo: Uint8Array): string;
}
