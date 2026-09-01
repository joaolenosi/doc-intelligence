import { CampoExtraido } from './campo-extraido.entidade';
import { Confianca } from './confianca.vo';
import { MotivoDeRevisao } from './motivo-de-revisao';
import { MotivoRegistrado } from './motivo-registrado';
import { SituacaoDocumento } from './situacao-documento';
import { TipoDocumento } from './tipo-documento';

export interface LimiaresDeConfianca {
  readonly tipo: Confianca;
  readonly campo: Confianca;
}

export interface EntradaDaPolitica {
  readonly tipo: TipoDocumento;
  readonly confiancaTipo: Confianca;
  readonly campos: readonly CampoExtraido[];
}

export interface DecisaoDeConfianca {
  readonly situacao: SituacaoDocumento.PROCESSED | SituacaoDocumento.REVIEW_REQUIRED;
  readonly motivos: readonly MotivoRegistrado[];
}

/**
 * Decide se o resultado da extracao entra como pronto ou para para conferencia.
 *
 * E a regra que atende o comportamento 4 do produto: quando a maquina nao tem
 * confianca no que produziu, o documento nao entra como pronto.
 *
 * A avaliacao e campo a campo e nunca pela media, porque media esconde. Um RG
 * com nome, filiacao e data de nascimento a 0,97 e o numero a 0,40 tem media
 * alta e e exatamente o caso que mais precisa de olho humano. E o motivo de o
 * campo extraido morar em tabela propria com confianca individual. Ver ADR-007.
 *
 * Os limiares chegam de fora porque sao configuracao, e porque os numeros de
 * partida sao chute declarado: nao existe dado real para calibra-los ainda.
 */
export class PoliticaDeConfianca {
  constructor(private readonly limiares: LimiaresDeConfianca) {}

  decidir(entrada: EntradaDaPolitica): DecisaoDeConfianca {
    const motivos: MotivoRegistrado[] = [];

    // Catalogo mal configurado e problema de configuracao, nao do documento.
    // Mesmo assim o documento para: um tipo cujo template ninguem consegue
    // montar nao deveria produzir resultado tratado como pronto.
    if (!entrada.tipo.catalogoValido) {
      motivos.push(MotivoRegistrado.de(MotivoDeRevisao.CATALOGO_INVALIDO));
    }

    // Tipo fora do catalogo e precisamente o caso em que o sistema nao deveria
    // decidir sozinho, entao ele para independente da confianca informada.
    if (entrada.tipo.ehDesconhecido) {
      motivos.push(MotivoRegistrado.de(MotivoDeRevisao.TIPO_DESCONHECIDO));
    } else if (entrada.confiancaTipo.abaixoDe(this.limiares.tipo)) {
      motivos.push(MotivoRegistrado.de(MotivoDeRevisao.CONFIANCA_TIPO_BAIXA));
    }

    const porNome = new Map(entrada.campos.map((campo) => [campo.nome, campo]));

    // Ordem estavel: a lista vai para o banco e para a resposta, e motivo que
    // muda de ordem entre execucoes torna qualquer comparacao inutil.
    for (const obrigatorio of [...entrada.tipo.camposObrigatorios].sort()) {
      const campo = porNome.get(obrigatorio);
      if (campo === undefined) {
        motivos.push(
          MotivoRegistrado.doCampo(MotivoDeRevisao.CAMPO_OBRIGATORIO_AUSENTE, obrigatorio),
        );
        continue;
      }
      if (campo.confianca.abaixoDe(this.limiares.campo)) {
        motivos.push(
          MotivoRegistrado.doCampo(MotivoDeRevisao.CONFIANCA_CAMPO_BAIXA, obrigatorio),
        );
      }
    }

    return {
      situacao:
        motivos.length === 0 ? SituacaoDocumento.PROCESSED : SituacaoDocumento.REVIEW_REQUIRED,
      motivos,
    };
  }
}
