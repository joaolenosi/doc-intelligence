import { FalhaTransitoriaDoExtrator } from '../../aplicacao/erros/erros-de-aplicacao';
import {
  ExtratorDeDocumento,
  ResultadoDaExtracao,
} from '../../aplicacao/portas/extrator-de-documento.porta';

/**
 * Envolve qualquer extrator com um limite de tempo.
 *
 * Timeout e responsabilidade do adaptador, e nao do caso de uso: o caso de uso
 * sabe distinguir falha transitoria de permanente, mas nao sabe quanto esperar.
 * Ver ADR-005.
 *
 * O valor padrao e 60s, acima dos 40s de pior caso do fato (a). Timeout mais
 * curto e a economia que custa caro: a chamada e cobrada por documento do lado
 * do fornecedor, entao cortar aos 30s uma resposta que chegaria aos 35s paga e
 * joga fora, e o retry paga de novo.
 *
 * Estar aqui, e nao dentro do duble, e o que faz o mesmo limite valer para
 * qualquer fornecedor que venha depois.
 */
export class ExtratorComTimeout implements ExtratorDeDocumento {
  constructor(
    private readonly interno: ExtratorDeDocumento,
    private readonly timeoutMs: number,
  ) {}

  async extrair(entrada: { conteudo: Uint8Array; tipoMidia: string }): Promise<ResultadoDaExtracao> {
    let cancelar: ReturnType<typeof setTimeout> | undefined;

    const limite = new Promise<never>((_, rejeitar) => {
      cancelar = setTimeout(
        () =>
          rejeitar(
            new FalhaTransitoriaDoExtrator(
              `Extrator nao respondeu em ${this.timeoutMs}ms`,
              'TIMEOUT',
            ),
          ),
        this.timeoutMs,
      );
    });

    try {
      return await Promise.race([this.interno.extrair(entrada), limite]);
    } finally {
      // Sem isso o processo fica de pe esperando o temporizador de cada chamada
      // que respondeu rapido, e o worker nao encerra.
      if (cancelar !== undefined) clearTimeout(cancelar);
    }
  }
}
