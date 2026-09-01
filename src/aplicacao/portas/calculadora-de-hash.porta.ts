import { HashConteudo } from '../../dominio/documento/hash-conteudo.vo';

/**
 * Calcula a identidade do documento a partir do conteudo.
 *
 * E porta e nao funcao do dominio porque escolher o algoritmo e detalhe
 * tecnico, e porque calcular exigiria node:crypto dentro do dominio.
 */
export interface CalculadoraDeHash {
  calcular(conteudo: Uint8Array): HashConteudo;
}
