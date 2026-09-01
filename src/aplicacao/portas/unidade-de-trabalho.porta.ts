/**
 * Executa um bloco de escritas como uma coisa so.
 *
 * Existe por causa de uma afirmacao do ADR-004 que so e verdadeira se houver
 * transacao: com o adaptador de fila em Postgres, gravar o documento e criar o
 * trabalho cabem na mesma transacao, e por isso a janela entre gravar e
 * publicar nao existe naquele adaptador.
 *
 * Com o adaptador BullMQ a janela continua existindo, porque o job vive no
 * Redis e nenhuma transacao do Postgres alcanca ele. A porta nao esconde isso:
 * ela garante atomicidade de quem participa da transacao, e o Redis nao
 * participa.
 */
export interface UnidadeDeTrabalho {
  executar<T>(trabalho: () => Promise<T>): Promise<T>;
}
