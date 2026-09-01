import { DataSource } from 'typeorm';
import {
  RepositorioDeSubmissao,
  ResumoDeSubmissoes,
} from '../../../../aplicacao/portas/repositorio-de-submissao.porta';
import { Submissao } from '../../../../dominio/submissao/submissao.entidade';
import { gerenciadorAtual } from '../contexto-transacional';
import { SubmissaoOrm } from '../entidades/submissao.orm-entity';

function paraDominio(linha: SubmissaoOrm): Submissao {
  return Submissao.reconstituir({
    id: Number(linha.id),
    documentoId: Number(linha.documentoId),
    nomeOriginal: linha.nomeOriginal,
    sistemaOrigem: linha.sistemaOrigem,
    criadoEm: linha.criadoEm,
    tipoMidiaInformado: linha.tipoMidiaInformado ?? undefined,
    chaveIdempotencia: linha.chaveIdempotencia ?? undefined,
  });
}

export class RepositorioDeSubmissaoTypeOrm implements RepositorioDeSubmissao {
  constructor(private readonly dataSource: DataSource) {}

  private get gerenciador() {
    return gerenciadorAtual(this.dataSource);
  }

  async registrar(submissao: Submissao, documentoId: number): Promise<Submissao> {
    const linha = this.gerenciador.create(SubmissaoOrm, {
      documentoId: String(documentoId),
      nomeOriginal: submissao.nomeOriginal,
      sistemaOrigem: submissao.sistemaOrigem,
      // Chave ausente vai como null, e nao como string vazia. O indice unico e
      // parcial e ignora nulo: com string vazia, todos os envios sem chave do
      // mesmo sistema colidiriam entre si.
      chaveIdempotencia: submissao.chaveIdempotencia ?? null,
      tipoMidiaInformado: submissao.tipoMidiaInformado ?? null,
      criadoEm: submissao.criadoEm,
    });
    return paraDominio(await this.gerenciador.save(linha));
  }

  async buscarPorIdempotencia(sistemaOrigem: string, chave: string): Promise<Submissao | undefined> {
    const linha = await this.gerenciador.findOne(SubmissaoOrm, {
      // Unicidade e do par, e nao da chave. Ver ADR-006.
      where: { sistemaOrigem, chaveIdempotencia: chave },
    });
    return linha === null ? undefined : paraDominio(linha);
  }

  async resumoPorDocumento(documentoId: number): Promise<ResumoDeSubmissoes> {
    // Uma consulta so, apoiada no indice (sub_doc_id, sub_criado_em DESC). O
    // GET pede as tres coisas juntas e nenhuma delas justifica ida separada.
    const linhas = await this.gerenciador.find(SubmissaoOrm, {
      where: { documentoId: String(documentoId) },
      order: { criadoEm: 'DESC', id: 'DESC' },
    });
    return {
      total: linhas.length,
      canais: [...new Set(linhas.map((linha) => linha.sistemaOrigem))],
      nomeOriginalMaisRecente: linhas[0]?.nomeOriginal ?? '',
    };
  }
}
