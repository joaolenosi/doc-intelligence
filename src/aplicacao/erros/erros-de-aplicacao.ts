/**
 * Erros que a camada de aplicacao entende e que os adaptadores levantam.
 *
 * A distincao entre transitorio e permanente e regra de negocio, e nao detalhe
 * tecnico, porque ela decide se o servico vai pagar outra chamada. Quem traduz
 * status HTTP e erro de rede para uma destas duas classes e o adaptador do
 * extrator: o caso de uso nunca ve status code. Ver ADR-005.
 */

export class FalhaTransitoriaDoExtrator extends Error {
  constructor(
    mensagem: string,
    readonly codigo: string,
  ) {
    super(mensagem);
    this.name = 'FalhaTransitoriaDoExtrator';
  }
}

export class FalhaPermanenteDoExtrator extends Error {
  constructor(
    mensagem: string,
    readonly codigo: string,
  ) {
    super(mensagem);
    this.name = 'FalhaPermanenteDoExtrator';
  }
}

/** Arquivo que nao passa na validacao de entrada. Vira 413 ou 415 na borda. */
export class ArquivoRecusado extends Error {
  constructor(
    mensagem: string,
    readonly codigo: 'TIPO_NAO_SUPORTADO' | 'TAMANHO_EXCEDIDO' | 'ARQUIVO_VAZIO',
  ) {
    super(mensagem);
    this.name = 'ArquivoRecusado';
  }
}

/**
 * Duas requisicoes simultaneas com o mesmo conteudo passaram as duas pela
 * consulta por hash e as duas tentaram gravar. O indice unico do banco recusou
 * a segunda, que e exatamente o papel dele: a consulta e otimizacao, a garantia
 * e do banco. Quem recebe este erro le de novo e trata como reenvio.
 */
export class ConflitoDeHash extends Error {
  constructor(readonly hash: string) {
    super('Documento com este conteudo ja existe');
    this.name = 'ConflitoDeHash';
  }
}

export class DocumentoNaoEncontrado extends Error {
  constructor(readonly documentoId: number) {
    super(`Documento ${documentoId} nao encontrado`);
    this.name = 'DocumentoNaoEncontrado';
  }
}
