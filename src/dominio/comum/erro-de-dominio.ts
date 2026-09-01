/**
 * Erro que nasce de uma regra de negocio violada, e nao de uma falha tecnica.
 *
 * Existe para a infraestrutura conseguir distinguir os dois sem inspecionar
 * mensagem: erro de dominio vira resposta de cliente, erro tecnico vira 500 e
 * alerta. Sem essa separacao, um CPF malformado e o banco fora do ar viram a
 * mesma coisa no log.
 *
 * A mensagem descreve a regra violada e nunca carrega valor de campo extraido,
 * por causa do fato (d): mensagem de erro vaza para log com a mesma facilidade
 * com que vaza para resposta.
 */
export class ErroDeDominio extends Error {
  constructor(
    mensagem: string,
    readonly codigo: string,
  ) {
    super(mensagem);
    this.name = new.target.name;
  }
}
