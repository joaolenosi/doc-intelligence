import { DataSource } from 'typeorm';
import { CatalogoDeTipos } from '../../../../aplicacao/portas/catalogo-de-tipos.porta';
import { TipoDocumento, TIPO_DESCONHECIDO } from '../../../../dominio/documento/tipo-documento';
import { gerenciadorAtual } from '../contexto-transacional';
import { TipoDocumentoOrm } from '../entidades/tipo-documento.orm-entity';
import { tipoParaDominio } from '../mapeadores/tipo-documento.mapeador';

/**
 * Le o catalogo de tipos do banco.
 *
 * Cacheia em memoria com validade curta. O catalogo muda por SQL, sem deploy,
 * entao cache eterno faria a mudanca so valer no proximo restart, e consulta a
 * cada documento seria uma ida ao banco por extracao para ler cinco linhas que
 * quase nunca mudam. Trinta segundos e o meio termo, e o custo de errar e o
 * catalogo demorar meio minuto para valer.
 */
const VALIDADE_MS = 30_000;

export class CatalogoDeTiposTypeOrm implements CatalogoDeTipos {
  private cache?: { tipos: Map<string, TipoDocumento>; expiraEm: number };

  constructor(private readonly dataSource: DataSource) {}

  async buscarPorCodigo(codigo: string): Promise<TipoDocumento | undefined> {
    const tipos = await this.carregar();
    const tipo = tipos.get(codigo.toUpperCase());
    return tipo?.ehDesconhecido === true ? undefined : tipo;
  }

  async desconhecido(): Promise<TipoDocumento> {
    const tipos = await this.carregar();
    const tipo = tipos.get(TIPO_DESCONHECIDO);
    if (tipo === undefined) {
      // Migration semeia esta linha. Se ela sumiu, o catalogo esta quebrado e o
      // servico nao tem para onde mandar tipo fora da lista.
      throw new Error('Catalogo sem o tipo DESCONHECIDO');
    }
    return tipo;
  }

  private async carregar(): Promise<Map<string, TipoDocumento>> {
    if (this.cache !== undefined && this.cache.expiraEm > Date.now()) return this.cache.tipos;

    const linhas = await gerenciadorAtual(this.dataSource).find(TipoDocumentoOrm, {
      where: { ativo: true },
    });
    const tipos = new Map(linhas.map((linha) => [linha.codigo, tipoParaDominio(linha)]));
    this.cache = { tipos, expiraEm: Date.now() + VALIDADE_MS };
    return tipos;
  }
}
