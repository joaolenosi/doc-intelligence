import { TipoDocumento } from '../../dominio/documento/tipo-documento';

/**
 * O catalogo de tipos, com os campos obrigatorios e o template de nome.
 *
 * E porta porque os dois sao decisao de negocio que muda sem deploy, e vivem em
 * tabela. Ver ADR-010.
 *
 * `desconhecido` nunca devolve indefinido: tipo fora do catalogo precisa de um
 * destino, e esse destino manda o documento para conferencia humana em vez de
 * deixar o sistema decidir sozinho.
 */
export interface CatalogoDeTipos {
  buscarPorCodigo(codigo: string): Promise<TipoDocumento | undefined>;
  desconhecido(): Promise<TipoDocumento>;
}
