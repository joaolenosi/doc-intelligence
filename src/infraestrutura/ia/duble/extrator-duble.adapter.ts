import { createHash } from 'node:crypto';
import {
  FalhaPermanenteDoExtrator,
  FalhaTransitoriaDoExtrator,
} from '../../../aplicacao/erros/erros-de-aplicacao';
import {
  CampoBruto,
  ExtratorDeDocumento,
  ResultadoDaExtracao,
} from '../../../aplicacao/portas/extrator-de-documento.porta';
import { ModoDoDuble } from '../../config/configuracao';
import { PROMPTS } from '../catalogo-de-prompts';

/**
 * O duble do modelo multimodal.
 *
 * O enunciado autoriza um duble que devolve sempre a mesma resposta, e este
 * devolve: a saida e derivada do hash do conteudo, entao o mesmo arquivo produz
 * sempre o mesmo resultado. Isso importa para o teste ponta a ponta ser estavel
 * e para a deduplicacao do fato (c) ser observavel.
 *
 * Os modos existem porque um duble que so acerta nao demonstra nada. Os fatos
 * (a) e (e) e o comportamento 4 do produto so aparecem quando da para provocar
 * lentidao, falha e confianca baixa, e nenhum deles seria exercitavel contra um
 * fornecedor real dentro de um teste.
 *
 * Todo dado aqui e ficticio, com identificadores invalidos de proposito. Fato
 * (d): nenhum documento real em lugar nenhum do projeto.
 */

const NOMES_FICTICIOS = [
  'MARIA FICTICIA DE SOUZA',
  'JOAO INVENTADO DA COSTA',
  'ANA EXEMPLO PEREIRA',
  'CARLOS TESTE DE ALMEIDA',
];

/** Todos reprovam na validacao de digito verificador, de proposito. */
const NUMEROS_INVALIDOS = ['000000000', '111111111', '999999999', '123456789'];

const ORGAOS = ['SSP/RN', 'SSP/SP', 'DETRAN/RJ', 'SSP/CE'];

const TIPOS = ['RG', 'CPF', 'COMPROVANTE_RESIDENCIA', 'CONTRACHEQUE'] as const;

/**
 * Marcador que as fixtures embutem para declarar que tipo elas representam.
 *
 * Sem ele, o tipo saia so do hash, e `rg-frente.jpeg` era classificado como
 * comprovante de residencia. Nao quebrava nada, mas fazia a demonstracao mentir
 * na primeira impressao, e quem esta avaliando comeca por ela.
 *
 * Ler um marcador no conteudo continua sendo determinismo e nao trapaca: o
 * duble le os bytes que recebeu, que e o que um modelo multimodal faria, so que
 * de um jeito trivial. Quando o marcador nao existe, e o caso de qualquer
 * arquivo que nao venha de `fixtures/`, o tipo volta a sair do hash.
 */
const MARCADOR_DE_TIPO = /TIPO-FIXTURE:\s*([A-Z_]+)/;

function tipoDeclarado(conteudo: Uint8Array): (typeof TIPOS)[number] | undefined {
  // So o comeco do arquivo: as fixtures colocam o marcador no cabecalho, e ler
  // o arquivo inteiro seria custo por nada num PDF de varias paginas.
  const inicio = Buffer.from(conteudo.subarray(0, 4096)).toString('latin1');
  const achado = inicio.match(MARCADOR_DE_TIPO)?.[1];
  return TIPOS.find((tipo) => tipo === achado);
}

const CAMPOS_POR_TIPO: Readonly<Record<string, readonly string[]>> = {
  RG: ['nome', 'filiacao', 'dataNascimento', 'numero', 'orgaoEmissor'],
  CPF: ['nome', 'numero'],
  COMPROVANTE_RESIDENCIA: ['titular', 'endereco', 'dataReferencia'],
  CONTRACHEQUE: ['nome', 'competencia', 'valorLiquido'],
};

export interface OpcoesDoDuble {
  readonly modo: ModoDoDuble;
  /** Só usado no modo LENTO, para o teste não esperar 40 segundos de verdade. */
  readonly dormir?: (ms: number) => Promise<void>;
}

export class ExtratorDuble implements ExtratorDeDocumento {
  private falhasRestantes: number;

  constructor(private readonly opcoes: OpcoesDoDuble) {
    // FALHA_TRANSITORIA falha duas vezes e acerta na terceira, que e o
    // caminho interessante: exercita o retry sem terminar sempre em FAILED.
    this.falhasRestantes = opcoes.modo === 'FALHA_TRANSITORIA' ? 2 : 0;
  }

  async extrair(entrada: { conteudo: Uint8Array; tipoMidia: string }): Promise<ResultadoDaExtracao> {
    const semente = this.semente(entrada.conteudo);
    const declarado = tipoDeclarado(entrada.conteudo);

    switch (this.opcoes.modo) {
      case 'TIMEOUT':
        // Nao resolve nunca. Quem corta e o ExtratorComTimeout, porque timeout
        // e responsabilidade do adaptador e nao do caso de uso. Ver ADR-005.
        return new Promise<ResultadoDaExtracao>(() => {});

      case 'FALHA_TRANSITORIA':
        if (this.falhasRestantes > 0) {
          this.falhasRestantes -= 1;
          throw new FalhaTransitoriaDoExtrator(
            'Fornecedor indisponivel, simulado pelo duble',
            'FORNECEDOR_INDISPONIVEL',
          );
        }
        return this.resultado(semente, 0.95, undefined, declarado);

      case 'LENTO': {
        // O fato (a) diz entre 5 e 40 segundos. A espera fica injetavel para o
        // teste nao precisar viver isso em tempo real.
        const espera = 5000 + (semente % 35_000);
        await (this.opcoes.dormir ?? padraoDormir)(espera);
        return this.resultado(semente, 0.95, undefined, declarado);
      }

      case 'BAIXA_CONFIANCA':
        // Um campo obrigatorio abaixo do limiar, com o resto alto. E o caso do
        // ADR-007: media alta escondendo o campo que importa.
        return this.resultado(semente, 0.95, 0.42, declarado);

      case 'SUCESSO':
        return this.resultado(semente, 0.95, undefined, declarado);

      default:
        throw new FalhaPermanenteDoExtrator(
          `Modo de duble desconhecido: ${this.opcoes.modo}`,
          'MODO_INVALIDO',
        );
    }
  }

  private semente(conteudo: Uint8Array): number {
    const digest = createHash('sha256').update(conteudo).digest();
    return digest.readUInt32BE(0);
  }

  private resultado(
    semente: number,
    confiancaBase: number,
    confiancaDoPrimeiroCampo?: number,
    tipoDeclaradoPelaFixture?: (typeof TIPOS)[number],
  ): ResultadoDaExtracao {
    const tipoCodigo = tipoDeclaradoPelaFixture ?? TIPOS[semente % TIPOS.length];
    const nomes = CAMPOS_POR_TIPO[tipoCodigo];

    const campos: CampoBruto[] = nomes.map((nome, indice) => ({
      nome,
      valor: this.valorFicticio(nome, semente + indice),
      // A confianca varia de leve entre campos para o resultado nao parecer
      // sintetico demais, e o campo escolhido cai abaixo do limiar no modo de
      // baixa confianca.
      confianca:
        indice === nomes.length - 1 && confiancaDoPrimeiroCampo !== undefined
          ? confiancaDoPrimeiroCampo
          : Number((confiancaBase - ((semente + indice) % 4) / 100).toFixed(3)),
    }));

    return {
      tipoCodigo,
      confiancaTipo: Number((confiancaBase - (semente % 3) / 100).toFixed(3)),
      campos,
      provedor: 'duble',
      modelo: 'duble-deterministico-1',
      versaoPrompt:
        tipoCodigo === 'RG' ? PROMPTS.extracaoRg.identificador : PROMPTS.classificacao.identificador,
      // Ordem de grandeza plausivel de uma chamada multimodal, para a coluna
      // pro_custo_estimado ter conteudo com que exercitar a consulta de custo.
      custoEstimado: 0.004,
    };
  }

  private valorFicticio(campo: string, semente: number): string {
    const escolher = <T>(lista: readonly T[]): T => lista[semente % lista.length];
    switch (campo) {
      case 'nome':
      case 'titular':
        return escolher(NOMES_FICTICIOS);
      case 'filiacao':
        return `${escolher(NOMES_FICTICIOS)}; ${escolher(NOMES_FICTICIOS)}`;
      case 'dataNascimento':
        return `19${70 + (semente % 30)}-0${1 + (semente % 9)}-1${semente % 9}`;
      case 'numero':
        return escolher(NUMEROS_INVALIDOS);
      case 'orgaoEmissor':
        return escolher(ORGAOS);
      case 'endereco':
        return `RUA FICTICIA ${semente % 900}, BAIRRO INVENTADO`;
      case 'dataReferencia':
        return `2026-0${1 + (semente % 9)}-01`;
      case 'competencia':
        return `2026-0${1 + (semente % 9)}`;
      case 'valorLiquido':
        return `${1000 + (semente % 5000)},00`;
      default:
        return 'VALOR FICTICIO';
    }
  }
}

const padraoDormir = (ms: number): Promise<void> =>
  new Promise((resolver) => setTimeout(resolver, ms));
