import { DataSource, QueryFailedError } from 'typeorm';
import { ConflitoDeHash } from '../../../../aplicacao/erros/erros-de-aplicacao';
import { RepositorioDeDocumento } from '../../../../aplicacao/portas/repositorio-de-documento.porta';
import { CampoExtraido } from '../../../../dominio/documento/campo-extraido.entidade';
import { Documento } from '../../../../dominio/documento/documento.entidade';
import { HashConteudo } from '../../../../dominio/documento/hash-conteudo.vo';
import { Relogio } from '../../../../aplicacao/portas/relogio.porta';
import { gerenciadorAtual } from '../contexto-transacional';
import { CampoExtraidoOrm } from '../entidades/campo-extraido.orm-entity';
import { DocumentoOrm } from '../entidades/documento.orm-entity';
import { TipoDocumentoOrm } from '../entidades/tipo-documento.orm-entity';
import { paraDominio, paraLinha, campoParaDominio, campoParaLinha } from '../mapeadores/documento.mapeador';
import { tipoParaDominio } from '../mapeadores/tipo-documento.mapeador';

/** Codigo do Postgres para violacao de restricao unica. */
const VIOLACAO_DE_UNICIDADE = '23505';

/**
 * O indice do hash, e so ele.
 *
 * A tabela tem duas restricoes unicas, e traduzir as duas para ConflitoDeHash
 * faria uma colisao de chave de armazenamento aparecer como documento
 * duplicado. O caso de uso trataria como reenvio, iria buscar o documento pelo
 * hash, nao acharia e relancaria um erro que nao explica nada. Um teste de
 * integracao com dois documentos compartilhando a chave foi o que revelou isso.
 */
const INDICE_DO_HASH = 'uq_doc_hash_conteudo';

export class RepositorioDeDocumentoTypeOrm implements RepositorioDeDocumento {
  constructor(
    private readonly dataSource: DataSource,
    private readonly relogio: Relogio,
  ) {}

  private get gerenciador() {
    return gerenciadorAtual(this.dataSource);
  }

  async salvar(documento: Documento): Promise<Documento> {
    try {
      const linha = this.gerenciador.create(DocumentoOrm, paraLinha(documento));
      const salva = await this.gerenciador.save(linha);
      return paraDominio(salva);
    } catch (erro) {
      // O indice unico no hash e a garantia de verdade contra o fato (c): a
      // consulta previa e otimizacao, e duas requisicoes simultaneas passam as
      // duas por ela. Traduzir aqui evita que o caso de uso conheca codigo de
      // erro do Postgres.
      const driver = erro instanceof QueryFailedError
        ? (erro.driverError as { code?: string; constraint?: string })
        : undefined;
      if (driver?.code === VIOLACAO_DE_UNICIDADE && driver.constraint === INDICE_DO_HASH) {
        throw new ConflitoDeHash(documento.hash.valor);
      }
      throw erro;
    }
  }

  async atualizar(documento: Documento, campos?: readonly CampoExtraido[]): Promise<void> {
    const id = documento.id as number;
    const tipoId = await this.idDoTipo(documento);

    await this.gerenciador.update(DocumentoOrm, { id: String(id) }, paraLinha(documento, tipoId));

    if (campos === undefined) return;

    // Apaga e regrava em vez de atualizar campo a campo. O conjunto de campos
    // de uma extracao e substituido inteiro, e o unique em (doc_id, nome)
    // tornaria a regravacao parcial um jogo de conflitos.
    await this.gerenciador.delete(CampoExtraidoOrm, { documentoId: String(id) });
    if (campos.length === 0) return;

    const agora = this.relogio.agora();
    await this.gerenciador.insert(
      CampoExtraidoOrm,
      campos.map((campo) => campoParaLinha(campo, id, agora) as CampoExtraidoOrm),
    );
  }

  async buscarPorId(id: number): Promise<Documento | undefined> {
    const linha = await this.gerenciador.findOne(DocumentoOrm, { where: { id: String(id) } });
    return linha === null ? undefined : this.comTipo(linha);
  }

  async buscarPorHash(hash: HashConteudo): Promise<Documento | undefined> {
    const linha = await this.gerenciador.findOne(DocumentoOrm, {
      where: { hashConteudo: hash.valor },
    });
    return linha === null ? undefined : this.comTipo(linha);
  }

  async camposDoDocumento(documentoId: number): Promise<readonly CampoExtraido[]> {
    const linhas = await this.gerenciador.find(CampoExtraidoOrm, {
      where: { documentoId: String(documentoId) },
      order: { nome: 'ASC' },
    });
    return linhas.map(campoParaDominio);
  }

  private async comTipo(linha: DocumentoOrm): Promise<Documento> {
    if (linha.tipoId === null || linha.tipoId === undefined) return paraDominio(linha);
    const tipo = await this.gerenciador.findOne(TipoDocumentoOrm, { where: { id: linha.tipoId } });
    return paraDominio(linha, tipo === null ? undefined : tipoParaDominio(tipo));
  }

  private async idDoTipo(documento: Documento): Promise<number | null> {
    if (documento.tipo === undefined) return null;
    const linha = await this.gerenciador.findOne(TipoDocumentoOrm, {
      where: { codigo: documento.tipo.codigo },
    });
    return linha?.id ?? null;
  }
}
