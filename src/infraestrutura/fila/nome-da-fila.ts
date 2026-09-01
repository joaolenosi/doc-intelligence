/**
 * O nome da fila, num lugar so.
 *
 * Publicador e consumidor precisam concordar, e string repetida em dois
 * arquivos e o tipo de divergencia que so aparece quando nada e processado e
 * ninguem entende por que.
 */
export const FILA_DE_PROCESSAMENTO = 'processamento-de-documento';

/**
 * Backoff exponencial com jitter, compartilhado pelos dois adaptadores.
 *
 * "Compartilhado" aqui e literal, e por dois caminhos diferentes porque as duas
 * APIs sao diferentes. O adaptador de Postgres chama esta funcao direto, ao
 * reagendar o trabalho. O do BullMQ a registra como estrategia customizada nas
 * `settings` do worker, porque o BullMQ nao aceita a espera vinda de quem
 * publica: quem publica so nomeia a estrategia, e quem consome a fornece.
 *
 * Ate a versao anterior o caminho do BullMQ usava o `exponential` nativo, com
 * `delay: 2000`, e este comentario ja dizia "compartilhado" sem que fosse
 * verdade. A progressao de base era a mesma, entao a diferenca real era o
 * jitter, que faltava justamente no adaptador padrao.
 *
 * `tentativa` conta as tentativas ja feitas, incluindo a que acabou de falhar,
 * entao a primeira espera e de 2000ms. E o mesmo significado do `attemptsMade`
 * que o BullMQ passa para a estrategia, e por isso um vai direto no outro.
 */
export function esperaAntesDeRetentar(tentativa: number): number {
  const base = 2000 * 2 ** (tentativa - 1);
  // O jitter existe porque, num pico, varios documentos falham no mesmo
  // segundo por causa do mesmo fornecedor fora do ar. Sem ele, todos voltariam
  // juntos e bateriam de novo no mesmo instante.
  return Math.round(base * (0.75 + Math.random() * 0.5));
}
