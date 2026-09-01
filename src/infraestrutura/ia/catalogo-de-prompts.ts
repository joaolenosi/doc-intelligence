import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Os prompts, versionados em arquivo e nao em configuracao invisivel.
 *
 * O fato (f) diz que os prompts vao mudar mais de uma vez no primeiro ano.
 * Arquivo versionado faz cada mudanca ser um commit com autor, data e diff, e
 * o identificador gravado em `pro_versao_prompt` amarra cada resultado ao
 * texto exato que o produziu.
 *
 * O `hash` existe porque a versao no nome depende de alguem lembrar de
 * incrementar. Se o conteudo mudar sem o nome mudar, o hash denuncia.
 */
export interface Prompt {
  readonly id: string;
  readonly versao: string;
  readonly identificador: string;
  readonly conteudo: string;
  readonly hash: string;
}

const DIRETORIO = join(__dirname, 'prompts');

function carregar(arquivo: string): Prompt {
  const conteudo = readFileSync(join(DIRETORIO, arquivo), 'utf8');
  const [, id, versao] = arquivo.match(/^(.+)\.(v\d+)\.md$/) ?? [];
  if (id === undefined || versao === undefined) {
    throw new Error(`Nome de prompt fora do padrao <id>.<versao>.md: ${arquivo}`);
  }
  return {
    id,
    versao,
    identificador: `${id}.${versao}`,
    conteudo,
    hash: createHash('sha256').update(conteudo).digest('hex').slice(0, 12),
  };
}

export const PROMPTS = {
  classificacao: carregar('classificacao.v1.md'),
  extracaoRg: carregar('extracao-rg.v1.md'),
} as const;
