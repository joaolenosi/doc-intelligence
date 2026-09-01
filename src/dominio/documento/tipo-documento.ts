import { ErroDeDominio } from '../comum/erro-de-dominio';
import { TemplateDeNome } from './template-de-nome';

/** Codigo reservado para o que o extrator classificou fora do catalogo. */
export const TIPO_DESCONHECIDO = 'DESCONHECIDO';

/**
 * Um tipo de documento, carregado do catalogo.
 *
 * Os campos obrigatorios e o template sao decisao de negocio e mudam sem aviso,
 * por isso vem de tabela e nao de constante. O dominio continua dono da regra e
 * recebe os parametros como dados. Ver ADR-010.
 */
export class TipoDocumento {
  private constructor(
    readonly codigo: string,
    readonly camposObrigatorios: readonly string[],
    readonly template: TemplateDeNome,
  ) {}

  static de(entrada: {
    codigo: string;
    camposObrigatorios: readonly string[];
    templateNome: string;
  }): TipoDocumento {
    const codigo = entrada.codigo.trim().toUpperCase();
    if (codigo.length === 0) {
      throw new ErroDeDominio('Tipo sem codigo', 'TIPO_SEM_CODIGO');
    }
    return new TipoDocumento(
      codigo,
      [...new Set(entrada.camposObrigatorios)],
      TemplateDeNome.de(entrada.templateNome),
    );
  }

  get ehDesconhecido(): boolean {
    return this.codigo === TIPO_DESCONHECIDO;
  }

  /**
   * Vazio quando o template so usa marcador embutido ou campo obrigatorio.
   * Preenchido quer dizer catalogo mal configurado, e nao documento ruim: a
   * distincao importa porque uma coisa se conserta com SQL e a outra com
   * conferencia humana.
   */
  marcadoresInvalidos(): string[] {
    return this.template.marcadoresInvalidos(this.camposObrigatorios);
  }

  get catalogoValido(): boolean {
    return this.marcadoresInvalidos().length === 0;
  }

  exigeCampo(nome: string): boolean {
    return this.camposObrigatorios.includes(nome);
  }
}
