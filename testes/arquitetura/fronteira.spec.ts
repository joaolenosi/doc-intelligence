import { join } from 'node:path';
import {
  arquivosTs,
  violacoesNoConteudo,
  violacoesNoDiretorio,
} from './detector-de-import';

const RAIZ = join(__dirname, '..', '..');
const CAMADAS_PROTEGIDAS = ['src/dominio', 'src/aplicacao'];

/**
 * Este e o teste que sustenta os 30% da nota. A regra de dependencia do ADR-002
 * so vale enquanto alguma coisa a verifica: regra de arquitetura sem teste que
 * a defenda dura ate o primeiro dia apertado.
 *
 * Ele nao pode ser afrouxado para fazer outro teste passar. Se ele falhar, a
 * resposta e mover o codigo para a infraestrutura e falar com o dominio por uma
 * porta, nunca acrescentar excecao a lista.
 */
describe('fronteira do dominio', () => {
  describe('o detector', () => {
    it('aceita importacao relativa', () => {
      const fonte = `
        import { Documento } from './documento.entidade';
        import type { Confianca } from '../valores/confianca.vo';
        export * from './erros';
      `;
      expect(violacoesNoConteudo(fonte)).toEqual([]);
    });

    it('recusa framework', () => {
      const fonte = `import { Injectable } from '@nestjs/common';`;
      expect(violacoesNoConteudo(fonte)).toHaveLength(1);
      expect(violacoesNoConteudo(fonte)[0].especificador).toBe('@nestjs/common');
    });

    it('recusa ORM, mesmo em importacao de tipo', () => {
      const fonte = `import type { Repository } from 'typeorm';`;
      expect(violacoesNoConteudo(fonte)[0].especificador).toBe('typeorm');
    });

    it('recusa builtin do Node, porque hash e relogio sao portas', () => {
      const fonte = `import { createHash } from 'node:crypto';`;
      expect(violacoesNoConteudo(fonte)[0].especificador).toBe('node:crypto');
    });

    it('recusa require e import dinamico, que sao a saida de emergencia obvia', () => {
      expect(violacoesNoConteudo(`const bull = require('bullmq');`)).toHaveLength(1);
      expect(violacoesNoConteudo(`const m = await import('ioredis');`)).toHaveLength(1);
    });

    it('ignora o que esta em comentario', () => {
      const fonte = `
        // import { Injectable } from '@nestjs/common';
        /* import { DataSource } from 'typeorm'; */
        import { Documento } from './documento.entidade';
      `;
      expect(violacoesNoConteudo(fonte)).toEqual([]);
    });

    it('aponta arquivo, linha e especificador, para a falha ser acionavel', () => {
      const fonte = `import { A } from './a';\nimport { B } from 'bullmq';`;
      const [violacao] = violacoesNoConteudo(fonte, 'src/dominio/x.ts');
      expect(violacao).toMatchObject({
        arquivo: 'src/dominio/x.ts',
        linha: 2,
        especificador: 'bullmq',
      });
    });
  });

  describe.each(CAMADAS_PROTEGIDAS)('%s', (camada) => {
    const diretorio = join(RAIZ, camada);

    it('nao importa nada de fora de si', () => {
      const violacoes = violacoesNoDiretorio(diretorio);
      const relato = violacoes
        .map((v) => `  ${v.arquivo.replace(RAIZ + '/', '')}:${v.linha}  ${v.trecho}`)
        .join('\n');
      expect(violacoes.length === 0 ? '' : `\n${relato}\n`).toBe('');
    });
  });

  it('as camadas protegidas existem, para o teste nao passar por engano', () => {
    for (const camada of CAMADAS_PROTEGIDAS) {
      expect(() => arquivosTs(join(RAIZ, camada))).not.toThrow();
    }
  });
});
