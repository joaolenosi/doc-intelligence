import { DataSource } from 'typeorm';
import { ProcessarDocumento } from '../../../aplicacao/casos-de-uso/processar-documento.caso-de-uso';
import { registrarFalha } from '../../comum/descrever-erro';
import { esperaAntesDeRetentar } from '../nome-da-fila';

/**
 * Consome a fila em banco com `FOR UPDATE SKIP LOCKED`.
 *
 * `SKIP LOCKED` e o que faz N workers pegarem trabalhos diferentes sem
 * coordenacao externa: cada um trava a linha que pegou e os outros pulam. E o
 * mesmo mecanismo que vai resolver o fato (g) quando a fila de conferencia
 * existir, com duas pessoas abrindo a fila ao mesmo tempo, e implementa-lo aqui
 * significa que la ele ja vai estar exercitado.
 *
 * O laco e por polling, e nao por notificacao. `LISTEN/NOTIFY` seria mais
 * elegante e daria latencia menor, mas neste volume, 0,11 documento por
 * segundo, um intervalo de um segundo e irrelevante perto dos 5 a 40 segundos
 * que a chamada leva. Polling tambem sobrevive a reinicio sem perder aviso.
 */
export interface OpcoesDoConsumidorPostgres {
  readonly dataSource: DataSource;
  readonly processar: ProcessarDocumento;
  readonly concorrencia: number;
  readonly maxTentativas: number;
  readonly intervaloMs?: number;
  readonly identificacao?: string;
}

interface TrabalhoReservado {
  flp_id: string;
  flp_doc_id: string;
  flp_tentativas: number;
}

export class ConsumidorPostgres {
  private rodando = false;
  private lacos: Promise<void>[] = [];

  constructor(private readonly opcoes: OpcoesDoConsumidorPostgres) {}

  iniciar(): void {
    if (this.rodando) return;
    this.rodando = true;
    // Um laco por unidade de concorrencia. Cada um reserva a sua propria linha,
    // e o SKIP LOCKED garante que eles nunca peguem a mesma.
    this.lacos = Array.from({ length: this.opcoes.concorrencia }, (_, indice) =>
      this.laco(indice),
    );
  }

  async parar(): Promise<void> {
    this.rodando = false;
    await Promise.all(this.lacos);
  }

  /** Processa um trabalho, se houver. Devolve se pegou algum. */
  async processarUm(): Promise<boolean> {
    const trabalho = await this.reservar();
    if (trabalho === undefined) return false;

    const documentoId = Number(trabalho.flp_doc_id);
    try {
      await this.opcoes.processar.executar(documentoId);
      await this.concluir(trabalho.flp_id);
    } catch {
      // O caso de uso so relanca quando a falha e transitoria e ainda ha
      // tentativa. Quando o teto acaba, ele marca FAILED e retorna, entao aqui
      // nao ha o que reagendar.
      await this.reagendar(trabalho);
    }
    return true;
  }

  private async laco(indice: number): Promise<void> {
    const intervalo = this.opcoes.intervaloMs ?? 1000;
    while (this.rodando) {
      let pegou = false;
      try {
        pegou = await this.processarUm();
      } catch (erro) {
        registrarFalha('laco_falhou', erro, { laco: indice });
      }
      // So dorme quando a fila esta vazia. Com trabalho disponivel o laco segue
      // direto, que e o que faz o pico drenar.
      if (!pegou) await dormir(intervalo);
    }
  }

  private async reservar(): Promise<TrabalhoReservado | undefined> {
    const resposta = await this.opcoes.dataSource.query(
      `UPDATE fila_processamento
          SET flp_situacao = 'EM_EXECUCAO',
              flp_reservado_em = NOW(),
              flp_reservado_por = $1,
              flp_atualizado_em = NOW()
        WHERE flp_id = (
          SELECT flp_id
            FROM fila_processamento
           WHERE flp_situacao = 'PENDENTE'
             AND flp_disponivel_em <= NOW()
           ORDER BY flp_disponivel_em
           FOR UPDATE SKIP LOCKED
           LIMIT 1
        )
        RETURNING flp_id, flp_doc_id, flp_tentativas`,
      [this.opcoes.identificacao ?? `worker-${process.pid}`],
    );
    // `query` devolve `[linhas, contagem]` num UPDATE com RETURNING, e so
    // `linhas` num SELECT. Ler o indice zero sem normalizar entrega o array
    // inteiro como se fosse uma linha, e o campo de tentativas chega undefined:
    // foi assim que quatro testes de integracao falharam antes desta linha
    // existir.
    const linhas: TrabalhoReservado[] = Array.isArray(resposta[0]) ? resposta[0] : resposta;
    return linhas[0];
  }

  private async concluir(id: string): Promise<void> {
    await this.opcoes.dataSource.query(
      `UPDATE fila_processamento
          SET flp_situacao = 'CONCLUIDO', flp_atualizado_em = NOW()
        WHERE flp_id = $1`,
      [id],
    );
  }

  private async reagendar(trabalho: TrabalhoReservado): Promise<void> {
    const tentativas = trabalho.flp_tentativas + 1;
    if (tentativas >= this.opcoes.maxTentativas) {
      await this.opcoes.dataSource.query(
        `UPDATE fila_processamento
            SET flp_situacao = 'FALHOU', flp_tentativas = $2, flp_atualizado_em = NOW()
          WHERE flp_id = $1`,
        [trabalho.flp_id, tentativas],
      );
      return;
    }

    await this.opcoes.dataSource.query(
      `UPDATE fila_processamento
          SET flp_situacao = 'PENDENTE',
              flp_tentativas = $2,
              flp_disponivel_em = NOW() + ($3 || ' milliseconds')::interval,
              flp_reservado_em = NULL,
              flp_reservado_por = NULL,
              flp_atualizado_em = NOW()
        WHERE flp_id = $1`,
      [trabalho.flp_id, tentativas, String(esperaAntesDeRetentar(tentativas))],
    );
  }
}

const dormir = (ms: number): Promise<void> =>
  new Promise((resolver) => setTimeout(resolver, ms));
