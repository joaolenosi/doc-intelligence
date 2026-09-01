import { DataSource } from 'typeorm';
import { PublicadorDeProcessamento } from '../../../aplicacao/portas/publicador-de-processamento.porta';
import { Relogio } from '../../../aplicacao/portas/relogio.porta';
import { gerenciadorAtual } from '../../persistencia/typeorm/contexto-transacional';
import { FilaProcessamentoOrm } from '../../persistencia/typeorm/entidades/fila-processamento.orm-entity';

/**
 * Publica o trabalho numa tabela do proprio Postgres.
 *
 * O ponto inteiro deste adaptador esta na primeira linha do metodo: ele usa o
 * gerenciador da transacao corrente. Gravar o documento e criar o trabalho
 * caem juntos, entao a janela que existe no adaptador BullMQ nao existe aqui.
 * E o que torna a afirmacao do ADR-004 verificavel em vez de retorica.
 */
export class PublicadorPostgres implements PublicadorDeProcessamento {
  constructor(
    private readonly dataSource: DataSource,
    private readonly relogio: Relogio,
  ) {}

  async publicar(documentoId: number): Promise<void> {
    const agora = this.relogio.agora();
    await gerenciadorAtual(this.dataSource).insert(FilaProcessamentoOrm, {
      documentoId: String(documentoId),
      situacao: 'PENDENTE',
      tentativas: 0,
      disponivelEm: agora,
      criadoEm: agora,
      atualizadoEm: agora,
    });
  }
}
