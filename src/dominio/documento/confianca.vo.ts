import { ErroDeDominio } from '../comum/erro-de-dominio';

/**
 * O quanto o modelo confia em um valor que ele proprio produziu.
 *
 * E um tipo proprio, e nao um number solto, porque a decisao mais importante do
 * servico depende dele: o comportamento 4 do produto diz que resultado sem
 * confianca nao entra como pronto. Um number aceita 1.5, aceita -3 e aceita
 * NaN, e qualquer um dos tres faria a comparacao com o limiar devolver uma
 * resposta com cara de valida.
 */
export class Confianca {
  private constructor(readonly valor: number) {}

  static de(valor: number): Confianca {
    if (!Number.isFinite(valor)) {
      throw new ErroDeDominio(
        'Confianca precisa ser um numero finito',
        'CONFIANCA_INVALIDA',
      );
    }
    if (valor < 0 || valor > 1) {
      throw new ErroDeDominio(
        `Confianca precisa estar entre 0 e 1, recebido ${valor}`,
        'CONFIANCA_FORA_DA_FAIXA',
      );
    }
    return new Confianca(valor);
  }

  abaixoDe(limiar: Confianca): boolean {
    return this.valor < limiar.valor;
  }

  toString(): string {
    return this.valor.toFixed(3);
  }
}
