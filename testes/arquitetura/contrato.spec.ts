import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gerarContrato } from '../../scripts/gerar-contrato';

const RAIZ = join(__dirname, '..', '..');
const ARQUIVO = join(RAIZ, 'docs', 'contrato-openapi.json');

/**
 * O contrato versionado precisa ser o que a aplicacao produz hoje.
 *
 * Sem este teste, o arquivo em `docs/` seria uma foto que envelhece: alguem
 * mudaria a forma de uma resposta, o contrato continuaria dizendo a forma
 * antiga, e a divergencia so apareceria quando um cliente quebrasse. Com ele, a
 * mudanca aparece como falha aqui e como diferenca no controle de versao, que e
 * exatamente o motivo de o arquivo ser versionado.
 */
describe('contrato OpenAPI', () => {
  const versionado = JSON.parse(readFileSync(ARQUIVO, 'utf8'));

  it('o arquivo versionado esta igual ao que a aplicacao gera', async () => {
    const gerado = await gerarContrato();
    expect(gerado).toEqual(versionado);
  });

  it('expoe exatamente as rotas que existem, e nada na raiz', () => {
    expect(Object.keys(versionado.paths).sort()).toEqual([
      '/healthz',
      '/v1/documentos',
      '/v1/documentos/{id}',
    ]);
    expect(versionado.paths['/']).toBeUndefined();
  });

  it('documenta os dois codigos de reenvio, que sao o coracao do fato (c)', () => {
    const respostas = versionado.paths['/v1/documentos'].post.responses;
    expect(Object.keys(respostas).sort()).toEqual(['200', '201', '400', '401', '413', '415']);
    expect(respostas['200'].description).toMatch(/reenvio/i);
  });

  describe('exemplos', () => {
    const texto = JSON.stringify(versionado);

    /**
     * Todo exemplo tem que ser ficticio, pelo mesmo motivo dos arquivos de
     * teste: exemplo de documentacao e copiado, colado e reaproveitado, e um
     * identificador valido acabaria parecendo dado de alguem.
     *
     * O nome sugerido entra nessa regra porque ele e montado a partir dos
     * campos extraidos e carrega nome de pessoa e numero de documento. Ver
     * ADR-012.
     */
    const ehCpfValido = (digitos: string): boolean => {
      if (!/^\d{11}$/.test(digitos) || /^(\d)\1{10}$/.test(digitos)) return false;
      const calcular = (ate: number): number => {
        let soma = 0;
        for (let i = 0; i < ate; i += 1) soma += Number(digitos[i]) * (ate + 1 - i);
        const resto = (soma * 10) % 11;
        return resto === 10 ? 0 : resto;
      };
      return calcular(9) === Number(digitos[9]) && calcular(10) === Number(digitos[10]);
    };

    it('nao contem nenhum CPF que passe na validacao de digito', () => {
      const candidatos = texto.match(/\d{11}/g) ?? [];
      expect(candidatos.filter(ehCpfValido)).toEqual([]);
    });

    it('o exemplo de nome sugerido usa identificador invalido de proposito', () => {
      const exemplo =
        versionado.components.schemas.RespostaDeConsulta.properties.nomePadronizado.example;
      expect(exemplo).toBe('RG_MARIA_FICTICIA_DE_SOUZA_000000000_2026-09-01.jpg');
      const digitos = (exemplo.match(/\d{9,}/g) ?? []) as string[];
      expect(digitos.every((d) => /^(\d)\1+$/.test(d) || !ehCpfValido(d))).toBe(true);
    });

    it('avisa que os exemplos sao ficticios na descricao do contrato', () => {
      expect(versionado.info.description).toMatch(/ficticio/i);
    });
  });
});
