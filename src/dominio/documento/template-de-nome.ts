import { ErroDeDominio } from '../comum/erro-de-dominio';

/**
 * O template do nome padronizado de um tipo, vindo de tpd_template_nome.
 *
 * Mora no dominio porque a regra e do dominio: montar, validar e recusar. O que
 * vem do catalogo e o texto, e nao a logica. Ver ADR-010.
 */

/**
 * Marcadores que o proprio servico resolve. Todo o resto e nome de campo
 * extraido, e por isso a lista precisa ser fechada: se `{data}` pudesse ser
 * confundido com um campo chamado data, o template deixaria de ser previsivel.
 */
export const MARCADORES_EMBUTIDOS: readonly string[] = ['tipo', 'data', 'extensao'];

export type ResultadoDoTemplate =
  | { montou: true; nome: string }
  | { montou: false; marcadoresSemValor: string[] };

export class TemplateDeNome {
  private static readonly MARCADOR = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

  private constructor(
    readonly bruto: string,
    readonly marcadores: readonly string[],
  ) {}

  static de(bruto: string): TemplateDeNome {
    const texto = bruto.trim();
    if (texto.length === 0) {
      throw new ErroDeDominio('Template de nome vazio', 'TEMPLATE_VAZIO');
    }

    TemplateDeNome.MARCADOR.lastIndex = 0;
    const marcadores = [...texto.matchAll(TemplateDeNome.MARCADOR)].map((m) => m[1]);

    // Chave que sobra depois de remover todo marcador bem formado e chave
    // desbalanceada ou marcador com caractere invalido. Um template assim
    // produziria um nome com `{` no meio, que passaria despercebido ate alguem
    // tentar gravar o arquivo.
    const resto = texto.replace(TemplateDeNome.MARCADOR, '');
    if (resto.includes('{') || resto.includes('}')) {
      throw new ErroDeDominio(
        `Template com chave desbalanceada ou marcador invalido: ${texto}`,
        'TEMPLATE_MALFORMADO',
      );
    }
    if (marcadores.length === 0) {
      throw new ErroDeDominio(
        `Template sem marcador nenhum produziria o mesmo nome para todo documento: ${texto}`,
        'TEMPLATE_SEM_MARCADOR',
      );
    }

    return new TemplateDeNome(texto, marcadores);
  }

  /**
   * Marcadores que nao sao embutidos nem campo obrigatorio do tipo.
   *
   * Campo opcional e recusado de proposito: um template que dependa dele
   * produziria nome incompleto como comportamento rotineiro, e nome incompleto
   * e exatamente o que se quer evitar.
   */
  marcadoresInvalidos(camposObrigatorios: readonly string[]): string[] {
    const permitidos = new Set([...MARCADORES_EMBUTIDOS, ...camposObrigatorios]);
    return [...new Set(this.marcadores.filter((m) => !permitidos.has(m)))];
  }

  /**
   * Substitui os marcadores. Os valores ja chegam normalizados: normalizar e
   * trabalho da politica de nomenclatura, e o template so monta.
   */
  render(valores: ReadonlyMap<string, string>): ResultadoDoTemplate {
    const semValor = [
      ...new Set(
        this.marcadores.filter((m) => {
          const valor = valores.get(m);
          return valor === undefined || valor.length === 0;
        }),
      ),
    ];
    if (semValor.length > 0) {
      return { montou: false, marcadoresSemValor: semValor };
    }

    TemplateDeNome.MARCADOR.lastIndex = 0;
    const nome = this.bruto.replace(
      TemplateDeNome.MARCADOR,
      (_todo, marcador: string) => valores.get(marcador) as string,
    );
    return { montou: true, nome };
  }
}
