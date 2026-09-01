export interface TentativaDeProcessamento {
  readonly documentoId: number;
  readonly tentativa: number;
  readonly provedor: string;
  readonly modelo: string;
  readonly versaoPrompt: string;
  readonly sucesso: boolean;
  readonly duracaoMs?: number;
  readonly custoEstimado?: number;
  readonly erroCodigo?: string;
  readonly erroMensagem?: string;
}

/**
 * Uma linha por tentativa de chamada ao modelo, e nao um contador no documento.
 *
 * Um contador responde apenas quantas vezes falhou. Guardar cada tentativa
 * responde quanto o fornecedor custou no mes, qual a taxa real de falha dele e
 * se a versao nova do modelo ficou mais lenta que a anterior, que sao as
 * perguntas que decidem contrato num servico cobrado por chamada. Ver ADR-011.
 *
 * A mensagem de erro e tecnica e nunca carrega conteudo do documento.
 */
export interface RegistroDeProcessamento {
  registrar(tentativa: TentativaDeProcessamento): Promise<void>;
  contarDoDocumento(documentoId: number): Promise<number>;
  ultimaDoDocumento(documentoId: number): Promise<TentativaDeProcessamento | undefined>;
}
