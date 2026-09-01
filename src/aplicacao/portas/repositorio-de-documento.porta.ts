import { Documento } from '../../dominio/documento/documento.entidade';
import { CampoExtraido } from '../../dominio/documento/campo-extraido.entidade';
import { HashConteudo } from '../../dominio/documento/hash-conteudo.vo';

/**
 * Persistencia do documento e dos campos que ele carrega.
 *
 * Campos entram junto com o documento porque eles nao existem sozinhos: um
 * campo extraido sem documento nao quer dizer nada, e gravar os dois em
 * chamadas separadas abriria a janela de um documento processado sem campos.
 *
 * `buscarPorHash` e o que evita pagar duas vezes pelo mesmo conteudo, fato (c).
 * A garantia final e o indice unico no banco, porque duas requisicoes
 * simultaneas do mesmo arquivo passariam as duas por esta consulta.
 */
export interface RepositorioDeDocumento {
  salvar(documento: Documento): Promise<Documento>;
  atualizar(documento: Documento, campos?: readonly CampoExtraido[]): Promise<void>;
  buscarPorId(id: number): Promise<Documento | undefined>;
  buscarPorHash(hash: HashConteudo): Promise<Documento | undefined>;
  camposDoDocumento(documentoId: number): Promise<readonly CampoExtraido[]>;
}
