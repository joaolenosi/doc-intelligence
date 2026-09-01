import { CampoExtraido } from './campo-extraido.entidade';
import { MARCADORES_EMBUTIDOS } from './template-de-nome';
import { TipoDocumento } from './tipo-documento';

export interface EntradaDaNomenclatura {
  readonly tipo: TipoDocumento;
  readonly campos: readonly CampoExtraido[];
  /** Data de referencia do documento quando o tipo tem uma, senao a de processamento. */
  readonly data: Date;
  /** Vem do tipo de midia detectado, nunca da que o cliente informou. */
  readonly extensao: string;
}

export type ResultadoDaNomenclatura =
  | { montou: true; nome: string }
  | { montou: false; marcadoresSemValor: string[] };

/** Folga sobre o limite de 255 da maioria dos sistemas de arquivos. */
const TAMANHO_MAXIMO_DO_NOME = 200;
const TAMANHO_MAXIMO_DO_VALOR = 40;

/**
 * Monta o nome padronizado proposto para o arquivo.
 *
 * O nome nunca deriva do nome enviado. O fato (b) diz que o arquivo chega como
 * "WhatsApp Image 2026-08-11 at 09.12.33.jpeg", e usar isso como base seria
 * propagar o problema que o servico existe para resolver. E o que impede path
 * traversal por nome de arquivo.
 *
 * O resultado e dado pessoal, apesar de parecer identificador tecnico: ele
 * carrega nome de pessoa, numero de documento e data. Nunca vai para log. Ver
 * ADR-012.
 */
export class PoliticaDeNomenclatura {
  /**
   * Os sete passos da especificacao. Os valores vem de extracao sobre foto,
   * entao chegam com acento, espaco duplo, quebra de linha e caractere que nao
   * pode compor nome de arquivo.
   *
   * O hifen sobrevive de proposito, porque `{data}` produz `2026-08-31` e
   * `competencia` costuma vir como `2026-07`.
   */
  static normalizar(valor: string): string {
    return valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/[^A-Z0-9_-]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, TAMANHO_MAXIMO_DO_VALOR)
      .replace(/_+$/g, '');
  }

  /**
   * Data em UTC, e nao no fuso local.
   *
   * Formatar no fuso do processo faria o mesmo documento receber nomes
   * diferentes conforme a maquina em que o worker rodasse, e o pico das 9h e
   * justamente quando mais worker sobe.
   */
  static formatarData(data: Date): string {
    const ano = data.getUTCFullYear().toString().padStart(4, '0');
    const mes = (data.getUTCMonth() + 1).toString().padStart(2, '0');
    const dia = data.getUTCDate().toString().padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  private static normalizarExtensao(extensao: string): string {
    return extensao.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  montar(entrada: EntradaDaNomenclatura): ResultadoDaNomenclatura {
    const valores = new Map<string, string>();

    // Os embutidos nao passam pela normalizacao de campo. A extensao ficaria em
    // maiuscula, produzindo `.JPG`, e o codigo do tipo e a data ja nascem no
    // formato certo.
    valores.set('tipo', entrada.tipo.codigo);
    valores.set('data', PoliticaDeNomenclatura.formatarData(entrada.data));
    valores.set('extensao', PoliticaDeNomenclatura.normalizarExtensao(entrada.extensao));

    for (const campo of entrada.campos) {
      if (MARCADORES_EMBUTIDOS.includes(campo.nome)) continue;
      valores.set(campo.nome, PoliticaDeNomenclatura.normalizar(campo.valor));
    }

    const resultado = entrada.tipo.template.render(valores);
    if (!resultado.montou) {
      return { montou: false, marcadoresSemValor: resultado.marcadoresSemValor };
    }
    return { montou: true, nome: PoliticaDeNomenclatura.truncar(resultado.nome) };
  }

  /** Corta o nome e preserva a extensao, que e o que identifica o formato. */
  private static truncar(nome: string): string {
    if (nome.length <= TAMANHO_MAXIMO_DO_NOME) return nome;

    const ultimoPonto = nome.lastIndexOf('.');
    if (ultimoPonto <= 0) return nome.slice(0, TAMANHO_MAXIMO_DO_NOME);

    const sufixo = nome.slice(ultimoPonto);
    const base = nome.slice(0, ultimoPonto);
    return base.slice(0, TAMANHO_MAXIMO_DO_NOME - sufixo.length).replace(/_+$/g, '') + sufixo;
  }
}
