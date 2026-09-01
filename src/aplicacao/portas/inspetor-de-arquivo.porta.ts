export interface ArquivoInspecionado {
  readonly tipoMidia: string;
  readonly extensao: string;
}

/**
 * Descobre o que o arquivo e, olhando os bytes.
 *
 * O fato (b) diz que nao existe validacao nenhuma do lado de quem envia, entao
 * nome, extensao e content-type informados sao metadado e nao entram em decisao
 * nenhuma. Um `.pdf` com bytes de JPEG e um JPEG.
 *
 * Levanta ArquivoRecusado quando o conteudo nao e um dos tipos aceitos, antes
 * de o documento custar qualquer coisa.
 */
export interface InspetorDeArquivo {
  inspecionar(conteudo: Uint8Array): ArquivoInspecionado;
}
