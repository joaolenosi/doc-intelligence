import { ErroDeDominio } from '../comum/erro-de-dominio';

/**
 * A identidade do documento.
 *
 * O fato (c) diz que o mesmo documento chega mais de uma vez, e o fato (b) diz
 * que ele chega com nome diferente a cada vez. So o conteudo permanece igual,
 * entao e ele que define identidade aqui, e nao o nome nem o caminho.
 *
 * O calculo mora numa porta, na infraestrutura. O dominio so sabe reconhecer um
 * hash bem formado, porque escolher o algoritmo e detalhe tecnico e obrigar o
 * dominio a importar node:crypto quebraria a regra do ADR-002.
 */
export class HashConteudo {
  private static readonly FORMATO = /^[0-9a-f]{64}$/;

  private constructor(readonly valor: string) {}

  static de(valor: string): HashConteudo {
    const normalizado = valor.trim().toLowerCase();
    if (!HashConteudo.FORMATO.test(normalizado)) {
      throw new ErroDeDominio(
        'Hash de conteudo precisa ter 64 caracteres hexadecimais',
        'HASH_INVALIDO',
      );
    }
    return new HashConteudo(normalizado);
  }

  igualA(outro: HashConteudo): boolean {
    return this.valor === outro.valor;
  }

  toString(): string {
    return this.valor;
  }
}
