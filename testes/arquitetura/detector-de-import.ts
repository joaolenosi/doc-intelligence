import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Encontra importacoes que atravessam a fronteira do dominio.
 *
 * A regra do ADR-002 e uma so: dominio e aplicacao nao importam nada que venha
 * de fora deles. Na pratica isso quer dizer que todo especificador de import
 * precisa ser relativo. Especificador nu como `@nestjs/common`, `typeorm` ou
 * mesmo `node:crypto` e violacao, porque hash tambem e porta.
 *
 * A deteccao e por texto e nao por AST de proposito. Um analisador completo
 * traria dependencia e complexidade para uma regra que cabe em tres expressoes,
 * e o custo de um falso positivo aqui e alguem ler a mensagem e ajustar, nao um
 * bug em producao.
 */

export interface Violacao {
  arquivo: string;
  linha: number;
  especificador: string;
  trecho: string;
}

const PADROES = [
  /\bimport\s+(?:type\s+)?(?:[\w*{}\n\r\t, ]+\s+from\s+)?['"]([^'"]+)['"]/g,
  /\bexport\s+(?:\*|{[^}]*})\s+from\s+['"]([^'"]+)['"]/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

function ehRelativo(especificador: string): boolean {
  return especificador.startsWith('./') || especificador.startsWith('../');
}

/** Analisa um conteudo de arquivo. Exposto para o proprio detector ter teste. */
export function violacoesNoConteudo(conteudo: string, arquivo = '(memoria)'): Violacao[] {
  const semComentarios = conteudo
    .replace(/\/\*[\s\S]*?\*\//g, (bloco) => bloco.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, '');

  const encontradas: Violacao[] = [];
  for (const padrao of PADROES) {
    padrao.lastIndex = 0;
    let achado: RegExpExecArray | null;
    while ((achado = padrao.exec(semComentarios)) !== null) {
      const especificador = achado[1];
      if (ehRelativo(especificador)) continue;
      encontradas.push({
        arquivo,
        linha: semComentarios.slice(0, achado.index).split('\n').length,
        especificador,
        trecho: achado[0].trim(),
      });
    }
  }
  return encontradas.sort((a, b) => a.linha - b.linha);
}

function arquivosTs(diretorio: string): string[] {
  let entradas: string[];
  try {
    entradas = readdirSync(diretorio);
  } catch {
    return [];
  }
  return entradas.flatMap((entrada) => {
    const caminho = join(diretorio, entrada);
    if (statSync(caminho).isDirectory()) return arquivosTs(caminho);
    return caminho.endsWith('.ts') ? [caminho] : [];
  });
}

/** Varre um diretorio inteiro. */
export function violacoesNoDiretorio(diretorio: string): Violacao[] {
  return arquivosTs(diretorio).flatMap((arquivo) =>
    violacoesNoConteudo(readFileSync(arquivo, 'utf8'), arquivo),
  );
}

export { arquivosTs };
