import { CampoExtraido, OrigemDoCampo } from '../../../../dominio/documento/campo-extraido.entidade';
import { ChaveArmazenamento } from '../../../../dominio/documento/chave-armazenamento.vo';
import { Confianca } from '../../../../dominio/documento/confianca.vo';
import { Documento } from '../../../../dominio/documento/documento.entidade';
import { HashConteudo } from '../../../../dominio/documento/hash-conteudo.vo';
import { MotivoDeRevisao } from '../../../../dominio/documento/motivo-de-revisao';
import { MotivoRegistrado } from '../../../../dominio/documento/motivo-registrado';
import { SituacaoDocumento } from '../../../../dominio/documento/situacao-documento';
import { TipoDocumento } from '../../../../dominio/documento/tipo-documento';
import { CampoExtraidoOrm } from '../entidades/campo-extraido.orm-entity';
import { DocumentoOrm } from '../entidades/documento.orm-entity';

/**
 * Traduz entre a entidade de ORM e a de dominio.
 *
 * E o custo explicito do ADR-002. Em troca, o dominio nao conhece decorator nem
 * coluna, e um campo novo aparece aqui como erro de compilacao em vez de virar
 * um `undefined` silencioso em producao.
 */

/**
 * Coluna anulavel chega como `null` do banco e, depois de um `save`, como o que
 * o transformador deixou. Tratar so `undefined` deixaria `Confianca.de(null)`
 * passar, e `Number.isFinite(null)` e falso, entao o documento inteiro falharia
 * na leitura. Foi assim que o teste de integracao pegou este caso.
 */
function opcional(valor: number | null | undefined): number | undefined {
  return valor === null || valor === undefined ? undefined : valor;
}

/** `CODIGO` ou `CODIGO:campo`, como o banco guarda. */
function motivoDeTexto(texto: string): MotivoRegistrado {
  const [codigo, campo] = texto.split(':');
  const conhecido = Object.values(MotivoDeRevisao).includes(codigo as MotivoDeRevisao);
  if (!conhecido) {
    // Motivo desconhecido vindo do banco e dado mais velho que o codigo, ou
    // codigo mais velho que o dado. Falhar aqui esconderia o documento inteiro
    // por causa de um rotulo, entao ele passa como CATALOGO_INVALIDO, que ja
    // significa "alguem precisa olhar".
    return MotivoRegistrado.de(MotivoDeRevisao.CATALOGO_INVALIDO);
  }
  return campo === undefined
    ? MotivoRegistrado.de(codigo as MotivoDeRevisao)
    : MotivoRegistrado.doCampo(codigo as MotivoDeRevisao, campo);
}

export function paraDominio(linha: DocumentoOrm, tipo?: TipoDocumento): Documento {
  return Documento.reconstituir({
    id: Number(linha.id),
    hash: HashConteudo.de(linha.hashConteudo),
    chaveArmazenamento: ChaveArmazenamento.de(linha.chaveArmazenamento),
    tipoMidia: linha.tipoMidia,
    tamanhoBytes: Number(linha.tamanhoBytes),
    situacao: linha.situacao as SituacaoDocumento,
    criadoEm: linha.criadoEm,
    atualizadoEm: linha.atualizadoEm,
    versao: linha.versao,
    motivosRevisao: (linha.motivosRevisao ?? []).map(motivoDeTexto),
    tipo,
    confiancaTipo:
      opcional(linha.confiancaTipo) === undefined
        ? undefined
        : Confianca.de(opcional(linha.confiancaTipo) as number),
    nomeSugerido: linha.nomeSugerido ?? undefined,
    processadoEm: linha.processadoEm ?? undefined,
  });
}

export function paraLinha(documento: Documento, tipoId?: number | null): Partial<DocumentoOrm> {
  const motivos = documento.motivosParaTexto();
  return {
    hashConteudo: documento.hash.valor,
    chaveArmazenamento: documento.chaveArmazenamento.valor,
    tipoMidia: documento.tipoMidia,
    tamanhoBytes: String(documento.tamanhoBytes),
    situacao: documento.situacao,
    tipoId: tipoId ?? null,
    confiancaTipo: documento.confiancaTipo?.valor,
    nomeSugerido: documento.nomeSugerido ?? null,
    // Vetor vazio violaria ck_doc_motivos_coerentes: a restricao exige nulo
    // quando a situacao nao e REVIEW_REQUIRED, e pelo menos um quando e.
    motivosRevisao: motivos.length > 0 ? motivos : null,
    versao: documento.versao,
    criadoEm: documento.criadoEm,
    atualizadoEm: documento.atualizadoEm,
    processadoEm: documento.processadoEm ?? null,
  };
}

export function campoParaDominio(linha: CampoExtraidoOrm): CampoExtraido {
  return linha.origem === OrigemDoCampo.CORRECAO_HUMANA
    ? CampoExtraido.daCorrecaoHumana(linha.nome, linha.valor)
    : CampoExtraido.doModelo(linha.nome, linha.valor, Confianca.de(linha.confianca));
}

export function campoParaLinha(
  campo: CampoExtraido,
  documentoId: number,
  agora: Date,
): Partial<CampoExtraidoOrm> {
  return {
    documentoId: String(documentoId),
    nome: campo.nome,
    valor: campo.valor,
    confianca: campo.confianca.valor,
    origem: campo.origem,
    atualizadoEm: agora,
  };
}
