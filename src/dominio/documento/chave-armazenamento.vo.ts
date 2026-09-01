import { ErroDeDominio } from '../comum/erro-de-dominio';

/**
 * A unica coisa que vira caminho no disco.
 *
 * E um tipo proprio porque essa e a fronteira onde path traversal entraria. O
 * fato (b) diz que o nome do arquivo vem da mao de quem enviou, e a defesa nao
 * e sanitizar esse nome: e nunca deixar ele chegar aqui. Um UUID e o formato
 * mais estreito possivel, e `../../etc/passwd` nao passa por ele.
 *
 * A geracao mora na infraestrutura. O dominio so sabe reconhecer o formato,
 * porque gerar UUID exigiria importar node:crypto e quebrar a fronteira.
 */
export class ChaveArmazenamento {
  private static readonly FORMATO =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  private constructor(readonly valor: string) {}

  static de(valor: string): ChaveArmazenamento {
    const normalizado = valor.trim().toLowerCase();
    if (!ChaveArmazenamento.FORMATO.test(normalizado)) {
      throw new ErroDeDominio(
        'Chave de armazenamento precisa ser um UUID',
        'CHAVE_ARMAZENAMENTO_INVALIDA',
      );
    }
    return new ChaveArmazenamento(normalizado);
  }

  toString(): string {
    return this.valor;
  }
}
