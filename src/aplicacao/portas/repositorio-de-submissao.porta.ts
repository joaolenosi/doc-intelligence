import { Submissao } from '../../dominio/submissao/submissao.entidade';

/** O que o GET devolve no bloco `submissoes`. */
export interface ResumoDeSubmissoes {
  readonly total: number;
  readonly canais: readonly string[];
  readonly nomeOriginalMaisRecente: string;
}

/**
 * Persistencia dos envios.
 *
 * `buscarPorIdempotencia` recebe o sistema junto com a chave porque a unicidade
 * e do par, e nao da chave. Dois sistemas internos geram identificador sem
 * coordenacao entre si, e uma colisao acidental faria um deles ter o envio
 * descartado em silencio. Ver ADR-006.
 */
export interface RepositorioDeSubmissao {
  registrar(submissao: Submissao, documentoId: number): Promise<Submissao>;
  buscarPorIdempotencia(sistemaOrigem: string, chave: string): Promise<Submissao | undefined>;
  resumoPorDocumento(documentoId: number): Promise<ResumoDeSubmissoes>;
}
