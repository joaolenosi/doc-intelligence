import { ErroDeDominio } from '../comum/erro-de-dominio';
import { Confianca } from './confianca.vo';

export enum OrigemDoCampo {
  MODELO = 'MODELO',
  CORRECAO_HUMANA = 'CORRECAO_HUMANA',
}

/**
 * Um campo que o modelo tirou do documento, com a confianca daquele valor.
 *
 * A confianca e por campo e nao por documento porque media esconde: um RG com
 * tres campos a 0,97 e o numero a 0,40 tem media alta e e o caso que mais
 * precisa de olho humano. Ver ADR-007.
 *
 * Esta e a classe que carrega o dado pessoal do fato (d). O valor nunca vai
 * para log, para mensagem de erro nem para evento de auditoria, e por isso
 * toString devolve so o nome do campo: se alguem interpolar um campo numa
 * string de log por descuido, sai `nome` e nao `MARIA DA SILVA`.
 */
export class CampoExtraido {
  private constructor(
    readonly nome: string,
    readonly valor: string,
    readonly confianca: Confianca,
    readonly origem: OrigemDoCampo,
  ) {}

  private static validar(nome: string, valor: string): { nome: string; valor: string } {
    const nomeLimpo = nome.trim();
    if (nomeLimpo.length === 0) {
      throw new ErroDeDominio('Campo extraido sem nome', 'CAMPO_SEM_NOME');
    }
    const valorLimpo = valor.trim();
    if (valorLimpo.length === 0) {
      // Campo em branco e campo que nao veio. Deixar entrar criaria uma linha
      // que satisfaz "o campo obrigatorio existe" sem satisfazer "o campo
      // obrigatorio tem valor", e o documento passaria como pronto vazio.
      throw new ErroDeDominio(
        `Campo ${nomeLimpo} veio em branco, que e o mesmo que nao ter vindo`,
        'CAMPO_EM_BRANCO',
      );
    }
    return { nome: nomeLimpo, valor: valorLimpo };
  }

  static doModelo(nome: string, valor: string, confianca: Confianca): CampoExtraido {
    const limpo = CampoExtraido.validar(nome, valor);
    return new CampoExtraido(limpo.nome, limpo.valor, confianca, OrigemDoCampo.MODELO);
  }

  /**
   * Confianca 1 porque uma pessoa olhou o documento e digitou o valor. Nao e
   * chute: e a unica leitura do sistema que teve verificacao humana, e deixar
   * ela herdar a confianca do modelo faria o campo corrigido continuar puxando
   * o documento para a fila de conferencia.
   */
  static daCorrecaoHumana(nome: string, valor: string): CampoExtraido {
    const limpo = CampoExtraido.validar(nome, valor);
    return new CampoExtraido(
      limpo.nome,
      limpo.valor,
      Confianca.de(1),
      OrigemDoCampo.CORRECAO_HUMANA,
    );
  }

  toString(): string {
    return `CampoExtraido(${this.nome})`;
  }
}
