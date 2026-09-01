export interface CampoBruto {
  readonly nome: string;
  readonly valor: string;
  readonly confianca: number;
}

export interface ResultadoDaExtracao {
  readonly tipoCodigo: string;
  readonly confiancaTipo: number;
  readonly campos: readonly CampoBruto[];
  readonly provedor: string;
  readonly modelo: string;
  readonly versaoPrompt: string;
  readonly custoEstimado?: number;
}

/**
 * A fronteira com o modelo multimodal. Na fatia implementada e um duble.
 *
 * Devolve numero cru e nao objeto de valor de proposito: isto e contrato com o
 * mundo de fora, e o mundo de fora nao conhece Confianca. Quem converte, e
 * portanto quem recusa 1.5, e o caso de uso.
 *
 * Carrega provedor, modelo e versao de prompt em todo resultado, porque o fato
 * (f) diz que o modelo vai trocar de versao e sem isso ninguem consegue provar
 * o que mudou quando a extracao piorar.
 *
 * Levanta FalhaTransitoriaDoExtrator ou FalhaPermanenteDoExtrator. Timeout e
 * classificacao de erro sao responsabilidade do adaptador.
 */
export interface ExtratorDeDocumento {
  extrair(entrada: { conteudo: Uint8Array; tipoMidia: string }): Promise<ResultadoDaExtracao>;
}
