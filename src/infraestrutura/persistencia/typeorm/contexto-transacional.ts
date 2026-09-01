import { AsyncLocalStorage } from 'node:async_hooks';
import { DataSource, EntityManager } from 'typeorm';
import { UnidadeDeTrabalho } from '../../../aplicacao/portas/unidade-de-trabalho.porta';

/**
 * Carrega o gerenciador transacional entre o caso de uso e os repositorios.
 *
 * O caso de uso chama `unidadeDeTrabalho.executar(...)` sem saber o que e uma
 * transacao, e os repositorios chamados la dentro precisam usar o mesmo
 * gerenciador para que as escritas caiam juntas. Passar o gerenciador por
 * parametro obrigaria a porta a expor um tipo do TypeORM, o que quebraria a
 * fronteira do ADR-002.
 *
 * AsyncLocalStorage resolve isso sem vazar tipo nenhum para a aplicacao. O
 * custo e uma indirecao invisivel, que e o motivo de este arquivo existir
 * sozinho e explicado.
 */
const contexto = new AsyncLocalStorage<EntityManager>();

/** O gerenciador da transacao corrente, ou o padrao quando nao ha transacao. */
export function gerenciadorAtual(dataSource: DataSource): EntityManager {
  return contexto.getStore() ?? dataSource.manager;
}

export class UnidadeDeTrabalhoTypeOrm implements UnidadeDeTrabalho {
  constructor(private readonly dataSource: DataSource) {}

  async executar<T>(trabalho: () => Promise<T>): Promise<T> {
    // Chamada aninhada participa da transacao de fora em vez de abrir outra.
    // Sem isso, um caso de uso que chame outro abriria duas transacoes e a
    // interna comitaria sozinha, desfazendo a garantia da externa.
    if (contexto.getStore() !== undefined) return trabalho();

    return this.dataSource.transaction((gerenciador) =>
      contexto.run(gerenciador, trabalho),
    );
  }
}
