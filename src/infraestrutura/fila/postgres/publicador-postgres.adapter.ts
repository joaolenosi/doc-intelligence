import { DataSource } from 'typeorm';
import { PublicadorDeProcessamento } from '../../../aplicacao/portas/publicador-de-processamento.porta';
import { gerenciadorAtual } from '../../persistencia/typeorm/contexto-transacional';

/**
 * Publica o trabalho numa tabela do proprio Postgres.
 *
 * O ponto inteiro deste adaptador esta na primeira linha do metodo: ele usa o
 * gerenciador da transacao corrente. Gravar o documento e criar o trabalho
 * caem juntos, entao a janela que existe no adaptador BullMQ nao existe aqui.
 * E o que torna a afirmacao do ADR-004 verificavel em vez de retorica.
 *
 * As datas vem do banco, e nao do relogio da aplicacao, e isso nao e detalhe.
 * O consumo pergunta por `flp_disponivel_em <= NOW()`, com o NOW() do servidor.
 * Se a disponibilidade fosse gravada com o relogio de quem publica, bastaria o
 * processo estar alguns milissegundos a frente do banco para o trabalho nascer
 * indisponivel e so ser pego no ciclo seguinte. Num host e um container, essa
 * diferenca existe; entre maquinas diferentes, ela e maior.
 *
 * Foi assim que dois testes ficaram intermitentes, e a intermitencia era o
 * sintoma correto de um problema real: relogio de quem escreve comparado com
 * relogio de quem le.
 */
export class PublicadorPostgres implements PublicadorDeProcessamento {
  constructor(private readonly dataSource: DataSource) {}

  async publicar(documentoId: number): Promise<void> {
    // Insert direto, sem passar as datas: as tres colunas tem DEFAULT NOW() na
    // migration, entao quem carimba o tempo e o banco. Uma so fonte de tempo
    // para a fila inteira, porque o backoff do consumidor tambem usa NOW().
    await gerenciadorAtual(this.dataSource).query(
      `INSERT INTO fila_processamento (flp_doc_id, flp_situacao, flp_tentativas)
       VALUES ($1, 'PENDENTE', 0)`,
      [documentoId],
    );
  }
}
