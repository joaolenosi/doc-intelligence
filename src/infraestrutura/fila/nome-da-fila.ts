/**
 * O nome da fila, num lugar so.
 *
 * Publicador e consumidor precisam concordar, e string repetida em dois
 * arquivos e o tipo de divergencia que so aparece quando nada e processado e
 * ninguem entende por que.
 */
export const FILA_DE_PROCESSAMENTO = 'processamento-de-documento';

/** Backoff exponencial com jitter, compartilhado pelos dois adaptadores. */
export function esperaAntesDeRetentar(tentativa: number): number {
  const base = 2000 * 2 ** (tentativa - 1);
  // O jitter existe porque, num pico, varios documentos falham no mesmo
  // segundo por causa do mesmo fornecedor fora do ar. Sem ele, todos voltariam
  // juntos e bateriam de novo no mesmo instante.
  return Math.round(base * (0.75 + Math.random() * 0.5));
}
