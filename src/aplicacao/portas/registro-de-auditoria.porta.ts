export interface EventoDeAuditoria {
  readonly documentoId?: number;
  readonly acao: string;
  readonly ator: string;
  /**
   * Nome de campo e contagem, nunca valor extraido e nunca nome sugerido.
   * O fato (d) vale aqui do mesmo jeito que vale no log, e o ADR-012 coloca o
   * nome sugerido nessa mesma lista apesar de ele parecer identificador.
   */
  readonly detalhe: Readonly<Record<string, unknown>>;
}

/** Trilha de acesso. Sobrevive ao apagamento do documento, por ON DELETE SET NULL. */
export interface RegistroDeAuditoria {
  registrar(evento: EventoDeAuditoria): Promise<void>;
}
