import { SituacaoDocumento } from '../../dominio/documento/situacao-documento';
import { DocumentoNaoEncontrado } from '../erros/erros-de-aplicacao';
import { RegistroDeProcessamento } from '../portas/registro-de-processamento.porta';
import { RepositorioDeDocumento } from '../portas/repositorio-de-documento.porta';
import {
  RepositorioDeSubmissao,
  ResumoDeSubmissoes,
} from '../portas/repositorio-de-submissao.porta';

export interface CampoDaConsulta {
  readonly nome: string;
  readonly valor: string;
  readonly confianca: number;
  readonly origem: string;
}

export interface ProcessamentoDaConsulta {
  readonly tentativas: number;
  readonly provedor?: string;
  readonly modelo?: string;
  readonly versaoPrompt?: string;
  readonly erro?: { readonly codigo: string; readonly mensagem?: string };
}

export interface ConsultaDeDocumento {
  readonly id: number;
  readonly situacao: SituacaoDocumento;
  readonly tipoDocumento?: string;
  readonly confiancaTipo?: number;
  readonly nomePadronizado?: string;
  readonly motivosRevisao: readonly string[];
  readonly campos: readonly CampoDaConsulta[];
  readonly submissoes: ResumoDeSubmissoes;
  readonly processamento: ProcessamentoDaConsulta;
  readonly criadoEm: Date;
  readonly processadoEm?: Date;
}

export interface DependenciasDeConsulta {
  readonly documentos: RepositorioDeDocumento;
  readonly submissoes: RepositorioDeSubmissao;
  readonly processamentos: RegistroDeProcessamento;
}

/** Situacoes em que existe resultado para devolver. */
const COM_RESULTADO: readonly SituacaoDocumento[] = [
  SituacaoDocumento.PROCESSED,
  SituacaoDocumento.REVIEW_REQUIRED,
];

/**
 * Monta a resposta do GET.
 *
 * Junta tres coisas que moram em tabelas diferentes de proposito: o documento,
 * o resumo das submissoes, que responde por quantos canais e quantas vezes
 * aquele conteudo chegou (fato c), e a ultima tentativa, que responde quanto ele
 * custou e qual modelo produziu o resultado (fato f).
 */
export class ConsultarDocumento {
  constructor(private readonly deps: DependenciasDeConsulta) {}

  async executar(documentoId: number): Promise<ConsultaDeDocumento> {
    const documento = await this.deps.documentos.buscarPorId(documentoId);
    if (documento === undefined) throw new DocumentoNaoEncontrado(documentoId);

    const [submissoes, tentativas, ultima] = await Promise.all([
      this.deps.submissoes.resumoPorDocumento(documentoId),
      this.deps.processamentos.contarDoDocumento(documentoId),
      this.deps.processamentos.ultimaDoDocumento(documentoId),
    ]);

    // Campo so aparece quando existe resultado. Em RECEIVED, PROCESSING, FAILED
    // e REJECTED nao ha o que devolver, e devolver lista vazia e diferente de
    // devolver campo com valor vazio.
    const campos = COM_RESULTADO.includes(documento.situacao)
      ? await this.deps.documentos.camposDoDocumento(documentoId)
      : [];

    return {
      id: documentoId,
      situacao: documento.situacao,
      tipoDocumento: documento.tipo?.codigo,
      confiancaTipo: documento.confiancaTipo?.valor,
      nomePadronizado: documento.nomeSugerido,
      motivosRevisao: documento.motivosParaTexto(),
      campos: campos.map((campo) => ({
        nome: campo.nome,
        valor: campo.valor,
        confianca: campo.confianca.valor,
        origem: campo.origem,
      })),
      submissoes,
      processamento: {
        tentativas,
        provedor: ultima?.provedor,
        modelo: ultima?.modelo,
        versaoPrompt: ultima?.versaoPrompt,
        erro:
          ultima?.sucesso === false && ultima.erroCodigo !== undefined
            ? { codigo: ultima.erroCodigo, mensagem: ultima.erroMensagem }
            : undefined,
      },
      criadoEm: documento.criadoEm,
      processadoEm: documento.processadoEm,
    };
  }
}
