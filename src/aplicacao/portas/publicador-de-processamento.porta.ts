/**
 * Enfileira o trabalho. So enfileira.
 *
 * Consumir e iniciativa da infraestrutura: o worker pega o trabalho e chama o
 * caso de uso. Se a porta tivesse os dois lados, a aplicacao passaria a
 * conhecer o ciclo de vida do consumidor, que e detalhe de quem entrega a
 * mensagem.
 *
 * Retry, backoff e concorrencia sao configuracao do adaptador e nao aparecem
 * aqui. O que o caso de uso sabe e distinguir falha transitoria de permanente e
 * que existe um teto de tentativas, porque isso e regra ligada a custo. Ver
 * ADR-004.
 */
export interface PublicadorDeProcessamento {
  publicar(documentoId: number): Promise<void>;
}
