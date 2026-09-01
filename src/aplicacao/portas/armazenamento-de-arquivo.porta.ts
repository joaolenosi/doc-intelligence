import { ChaveArmazenamento } from '../../dominio/documento/chave-armazenamento.vo';

/**
 * Onde o binario mora.
 *
 * O armazenamento gera a chave, e nao a recebe. Isso concentra num lugar so a
 * garantia de que o caminho no disco nunca deriva de nada que veio de fora, que
 * e a defesa contra path traversal do fato (b).
 *
 * Trocar disco por object storage e escrever outro adaptador desta interface e
 * mudar uma fabrica. Esta e a troca mais barata do projeto.
 */
export interface ArmazenamentoDeArquivo {
  guardar(conteudo: Uint8Array, extensao: string): Promise<ChaveArmazenamento>;
  ler(chave: ChaveArmazenamento): Promise<Uint8Array>;
}
