import { ConsultaDeDocumento } from '../../../aplicacao/casos-de-uso/consultar-documento.caso-de-uso';
import { Documento } from '../../../dominio/documento/documento.entidade';

/**
 * Monta o corpo das respostas.
 *
 * E uma camada fina de proposito, mas separada: o formato exposto e contrato
 * com quem consome, e deixa-lo sair direto da entidade faria qualquer
 * renomeacao interna virar quebra de contrato sem ninguem perceber.
 */
export function apresentarRecebimento(documento: Documento, jaExistia: boolean) {
  return {
    id: documento.id,
    estado: documento.situacao,
    hashConteudo: documento.hash.valor,
    tipoMidia: documento.tipoMidia,
    tamanhoBytes: documento.tamanhoBytes,
    // O reenvio mudava so o status code, entao quem lia o corpo nao sabia se
    // tinha criado ou reencontrado. Ver ADR-006.
    jaExistia,
    criadoEm: documento.criadoEm.toISOString(),
  };
}

export function apresentarConsulta(consulta: ConsultaDeDocumento) {
  return {
    id: consulta.id,
    estado: consulta.situacao,
    tipoDocumento: consulta.tipoDocumento ?? null,
    confiancaTipo: consulta.confiancaTipo ?? null,
    nomePadronizado: consulta.nomePadronizado ?? null,
    motivosRevisao: consulta.motivosRevisao,
    campos: consulta.campos.map((campo) => ({
      nome: campo.nome,
      valor: campo.valor,
      confianca: campo.confianca,
      origem: campo.origem,
    })),
    submissoes: {
      total: consulta.submissoes.total,
      canais: consulta.submissoes.canais,
      nomeOriginalMaisRecente: consulta.submissoes.nomeOriginalMaisRecente,
    },
    processamento: {
      tentativas: consulta.processamento.tentativas,
      provedor: consulta.processamento.provedor ?? null,
      modelo: consulta.processamento.modelo ?? null,
      versaoPrompt: consulta.processamento.versaoPrompt ?? null,
      erro: consulta.processamento.erro ?? null,
    },
    criadoEm: consulta.criadoEm.toISOString(),
    processadoEm: consulta.processadoEm?.toISOString() ?? null,
  };
}
