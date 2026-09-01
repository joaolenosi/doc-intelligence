import { ErroDeDominio } from '../comum/erro-de-dominio';

/**
 * Um envio de documento.
 *
 * Existe separada do documento por causa do fato (c): o cliente reenvia por
 * inseguranca e o atendimento reenvia por precaucao, e o mesmo conteudo chega
 * com nome diferente a cada vez. Guardar o nome e a origem no documento
 * preservaria so o primeiro envio. Ver ADR-006.
 *
 * O nome original e guardado como veio, e e so registro. Ele nao tem metodo que
 * o transforme em caminho, nome de arquivo ou identificador, porque o fato (b)
 * diz que ele vem da mao de quem enviou. Quem vira caminho no disco e a
 * ChaveArmazenamento.
 */
export class Submissao {
  private constructor(
    readonly nomeOriginal: string,
    readonly sistemaOrigem: string,
    readonly criadoEm: Date,
    readonly tipoMidiaInformado?: string,
    readonly chaveIdempotencia?: string,
    readonly id?: number,
    readonly documentoId?: number,
  ) {}

  static registrar(entrada: {
    nomeOriginal: string;
    sistemaOrigem: string;
    criadoEm: Date;
    tipoMidiaInformado?: string;
    chaveIdempotencia?: string;
  }): Submissao {
    const sistema = entrada.sistemaOrigem.trim();
    if (sistema.length === 0) {
      // O sistema de origem e obrigatorio porque a unicidade da chave de
      // idempotencia e por par sistema mais chave. Sem ele, dois sistemas
      // internos que gerem `req-1` sem coordenacao entre si atropelariam um ao
      // outro, e o sintoma seria um envio que sumiu sem erro. Ver ADR-006.
      throw new ErroDeDominio('Submissao sem sistema de origem', 'SISTEMA_ORIGEM_AUSENTE');
    }

    const nome = entrada.nomeOriginal.trim();
    if (nome.length === 0) {
      throw new ErroDeDominio('Submissao sem nome original', 'NOME_ORIGINAL_AUSENTE');
    }

    const chave = entrada.chaveIdempotencia?.trim();
    return new Submissao(
      nome,
      sistema,
      entrada.criadoEm,
      entrada.tipoMidiaInformado?.trim() || undefined,
      chave !== undefined && chave.length > 0 ? chave : undefined,
    );
  }

  static reconstituir(estado: {
    id: number;
    documentoId: number;
    nomeOriginal: string;
    sistemaOrigem: string;
    criadoEm: Date;
    tipoMidiaInformado?: string;
    chaveIdempotencia?: string;
  }): Submissao {
    return new Submissao(
      estado.nomeOriginal,
      estado.sistemaOrigem,
      estado.criadoEm,
      estado.tipoMidiaInformado,
      estado.chaveIdempotencia,
      estado.id,
      estado.documentoId,
    );
  }

  /**
   * O cliente informou um tipo de midia diferente do que os bytes dizem. A
   * diferenca e a medida de quanto quem envia erra, e o fato (b) diz que nao ha
   * validacao nenhuma do outro lado.
   */
  informouTipoDivergente(tipoMidiaReal: string): boolean {
    return this.tipoMidiaInformado !== undefined && this.tipoMidiaInformado !== tipoMidiaReal;
  }
}
