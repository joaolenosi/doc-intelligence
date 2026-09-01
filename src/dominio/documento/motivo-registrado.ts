import { MotivoDeRevisao } from './motivo-de-revisao';

/**
 * Um motivo que mandou o documento para conferencia, com o campo a que ele se
 * refere quando existe um.
 *
 * "Confianca baixa" sozinho nao ajuda quem vai conferir: confianca baixa em
 * qual campo muda o que a pessoa olha primeiro. Por isso o motivo carrega o
 * nome do campo, no formato `CODIGO:campo`.
 *
 * Nome de campo, e nunca valor de campo. O motivo viaja para o banco, para a
 * resposta do GET e para o log, e nos tres lugares o fato (d) vale.
 */
export class MotivoRegistrado {
  private constructor(
    readonly codigo: MotivoDeRevisao,
    readonly campo?: string,
  ) {}

  static de(codigo: MotivoDeRevisao): MotivoRegistrado {
    return new MotivoRegistrado(codigo);
  }

  static doCampo(codigo: MotivoDeRevisao, campo: string): MotivoRegistrado {
    return new MotivoRegistrado(codigo, campo);
  }

  paraTexto(): string {
    return this.campo === undefined ? this.codigo : `${this.codigo}:${this.campo}`;
  }

  toString(): string {
    return this.paraTexto();
  }
}
