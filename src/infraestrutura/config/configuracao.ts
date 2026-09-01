/**
 * Configuracao tipada, lida uma vez na subida.
 *
 * Ler `process.env` espalhado pelo codigo transforma variavel de ambiente
 * ausente em `undefined` viajando ate produzir um erro longe da causa. Aqui a
 * leitura falha na subida, dizendo qual variavel falta.
 *
 * Os numeros carregam de onde vieram, porque nenhum deles e arbitrario e o
 * proximo a mexer merece saber disso.
 */

function texto(nome: string, padrao?: string): string {
  const valor = process.env[nome] ?? padrao;
  if (valor === undefined) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${nome}`);
  }
  return valor;
}

function numero(nome: string, padrao: number): number {
  const bruto = process.env[nome];
  if (bruto === undefined) return padrao;
  const valor = Number(bruto);
  if (!Number.isFinite(valor)) {
    throw new Error(`Variavel ${nome} precisa ser numerica, recebido "${bruto}"`);
  }
  return valor;
}

export type AdaptadorDeFila = 'bullmq' | 'postgres';
export type ModoDoDuble = 'SUCESSO' | 'BAIXA_CONFIANCA' | 'FALHA_TRANSITORIA' | 'TIMEOUT' | 'LENTO';

export interface Configuracao {
  readonly banco: {
    host: string;
    porta: number;
    usuario: string;
    senha: string;
    base: string;
  };
  readonly fila: {
    /** Trocar aqui e derrubar o Redis e a demonstracao do ADR-004. */
    adaptador: AdaptadorDeFila;
    /**
     * 800 documentos em 2h dao 0,11 por segundo, que a 40s de pior caso exigem
     * 4,4 execucoes simultaneas. Arredondado para 5. O numero real depende do
     * limite de chamadas do fornecedor, que eu nao conheco.
     */
    concorrencia: number;
    redisHost: string;
    redisPorta: number;
  };
  readonly extrator: {
    modoDoDuble: ModoDoDuble;
    /**
     * Acima dos 40s de pior caso do fato (a). Timeout mais curto pagaria a
     * chamada e jogaria a resposta fora. Ver ADR-005.
     */
    timeoutMs: number;
    /** Finito porque cada tentativa e cobrada. */
    maxTentativas: number;
  };
  readonly confianca: {
    /** Chute declarado. Nao existe dado real para calibrar ainda. */
    limiarTipo: number;
    limiarCampo: number;
  };
  readonly upload: {
    /** Foto original de celular fica entre 3 e 12 MB. Fato (b). */
    tamanhoMaximoBytes: number;
  };
  readonly armazenamento: { diretorio: string };
  /** Fronteira de autenticacao, nao seguranca. Ver especificacao. */
  readonly apiKey: string;
}

export function carregarConfiguracao(): Configuracao {
  const adaptador = texto('FILA_ADAPTADOR', 'bullmq');
  if (adaptador !== 'bullmq' && adaptador !== 'postgres') {
    throw new Error(`FILA_ADAPTADOR precisa ser bullmq ou postgres, recebido "${adaptador}"`);
  }

  return {
    banco: {
      host: texto('POSTGRES_HOST', 'localhost'),
      porta: numero('POSTGRES_PORT', 5432),
      usuario: texto('POSTGRES_USER', 'doc'),
      senha: texto('POSTGRES_PASSWORD', 'doc'),
      base: texto('POSTGRES_DB', 'doc_intelligence'),
    },
    fila: {
      adaptador,
      concorrencia: numero('FILA_CONCORRENCIA', 5),
      redisHost: texto('REDIS_HOST', 'localhost'),
      redisPorta: numero('REDIS_PORT', 6379),
    },
    extrator: {
      modoDoDuble: texto('DUBLE_MODO', 'SUCESSO') as ModoDoDuble,
      timeoutMs: numero('EXTRATOR_TIMEOUT_MS', 60_000),
      maxTentativas: numero('EXTRATOR_MAX_TENTATIVAS', 3),
    },
    confianca: {
      limiarTipo: numero('CONFIANCA_LIMIAR_TIPO', 0.8),
      limiarCampo: numero('CONFIANCA_LIMIAR_CAMPO', 0.85),
    },
    upload: { tamanhoMaximoBytes: numero('UPLOAD_TAMANHO_MAXIMO_BYTES', 26_214_400) },
    armazenamento: { diretorio: texto('ARMAZENAMENTO_DIRETORIO', './storage') },
    apiKey: texto('API_KEY', 'troque-esta-chave'),
  };
}
