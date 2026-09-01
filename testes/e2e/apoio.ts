import { APIRequestContext, expect } from '@playwright/test';

/** Bytes que passam na inspecao como JPEG, com um marcador para variar o hash. */
export function jpeg(marcador: string): Buffer {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.from(marcador, 'utf8'),
    Buffer.alloc(64),
  ]);
}

export const SISTEMA = 'crm-atendimento';

export async function enviar(
  requisicao: APIRequestContext,
  opcoes: {
    conteudo: Buffer;
    nome: string;
    sistema?: string;
    chaveIdempotencia?: string;
    semChaveDeApi?: boolean;
    chaveDeApi?: string;
  },
) {
  const cabecalhos: Record<string, string> = {};
  if (opcoes.sistema !== undefined) cabecalhos['x-sistema-origem'] = opcoes.sistema;
  if (opcoes.chaveIdempotencia !== undefined) {
    cabecalhos['idempotency-key'] = opcoes.chaveIdempotencia;
  }
  if (opcoes.semChaveDeApi === true) cabecalhos['x-api-key'] = '';
  if (opcoes.chaveDeApi !== undefined) cabecalhos['x-api-key'] = opcoes.chaveDeApi;

  return requisicao.post('/v1/documentos', {
    headers: cabecalhos,
    multipart: {
      arquivo: {
        name: opcoes.nome,
        // O tipo informado mente de proposito em varios testes: quem decide e a
        // inspecao dos bytes. Fato (b).
        mimeType: 'application/octet-stream',
        buffer: opcoes.conteudo,
      },
    },
  });
}

/**
 * Espera o worker de verdade terminar.
 *
 * O polling aqui e o mesmo que o contrato pede de quem consome, entao este
 * helper e tambem uma prova de que o contrato do ADR-008 e utilizavel.
 */
export async function esperarSituacaoFinal(
  requisicao: APIRequestContext,
  id: number,
  tentativas = 40,
): Promise<Record<string, any>> {
  for (let i = 0; i < tentativas; i += 1) {
    const resposta = await requisicao.get(`/v1/documentos/${id}`);
    expect(resposta.status()).toBe(200);
    const corpo = await resposta.json();
    if (corpo.estado !== 'RECEIVED' && corpo.estado !== 'PROCESSING') return corpo;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Documento ${id} nao saiu de RECEIVED/PROCESSING a tempo`);
}
