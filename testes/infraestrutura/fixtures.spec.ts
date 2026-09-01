import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ArquivoRecusado } from '../../src/aplicacao/erros/erros-de-aplicacao';
import { InspetorMagicBytes } from '../../src/infraestrutura/inspecao/inspetor-magic-bytes.adapter';
import { montarFixtures } from '../../scripts/gerar-fixtures';

const DIRETORIO = join(__dirname, '..', '..', 'fixtures');
const inspetor = new InspetorMagicBytes();
const fixtures = montarFixtures();

/**
 * As fixtures sao documentacao executavel: o `fixtures/README.md` diz o que
 * cada arquivo deve provocar, e este teste garante que ele nao esta mentindo.
 *
 * Tambem garante que o arquivo no disco e o que o gerador produz hoje. Sem
 * isso, alguem editaria um fixture na mao, o README continuaria descrevendo o
 * antigo, e o exemplo de uso do README pararia de funcionar sem aviso.
 */
describe('fixtures', () => {
  const noDisco = (arquivo: string) => readFileSync(join(DIRETORIO, arquivo));

  it.each(fixtures.map((f) => [f.arquivo, f]))(
    '%s esta no disco igual ao que o gerador produz',
    (_nome, fixture) => {
      expect(noDisco(fixture.arquivo).equals(fixture.conteudo)).toBe(true);
    },
  );

  describe('classificacao pela inspecao', () => {
    const aceitos = fixtures.filter((f) => f.tipoMidiaEsperado !== undefined);
    const recusados = fixtures.filter((f) => f.tipoMidiaEsperado === undefined);

    it.each(aceitos.map((f) => [f.arquivo, f.tipoMidiaEsperado as string]))(
      '%s e reconhecido como %s',
      (arquivo, esperado) => {
        expect(inspetor.inspecionar(noDisco(arquivo))).toBe(esperado);
      },
    );

    it.each(recusados.map((f) => [f.arquivo]))('%s e recusado', (arquivo) => {
      expect(() => inspetor.inspecionar(noDisco(arquivo))).toThrow(ArquivoRecusado);
    });

    /**
     * O fato (b) diz que nao existe validacao nenhuma do lado de quem envia.
     * Este fixture existe so para provar que o nome nao decide nada.
     */
    it('rg-que-e-word.jpeg e recusado apesar do nome dizer imagem', () => {
      expect(() => inspetor.inspecionar(noDisco('rg-que-e-word.jpeg'))).toThrow(
        /JPEG, PNG, HEIC nem PDF/,
      );
    });
  });

  /**
   * O reenvio do fato (c) so e exercitavel se dois arquivos com nomes
   * diferentes tiverem exatamente o mesmo conteudo.
   */
  it('rg-reenvio.jpeg tem o mesmo hash de rg-frente.jpeg, com outro nome', () => {
    const hash = (arquivo: string) =>
      createHash('sha256').update(noDisco(arquivo)).digest('hex');
    expect(hash('rg-reenvio.jpeg')).toBe(hash('rg-frente.jpeg'));
  });

  /**
   * O enunciado proibe dado real de cliente. Aqui isso vira verificacao, e nao
   * promessa: nenhum numero de onze digitos nas fixtures passa na validacao de
   * digito de CPF.
   */
  it('nao contem nenhum identificador que passe em validacao de digito', () => {
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

    for (const fixture of fixtures) {
      const texto = noDisco(fixture.arquivo).toString('latin1');
      const candidatos = texto.match(/\d{11}/g) ?? [];
      expect({ [fixture.arquivo]: candidatos.filter(ehCpfValido) }).toEqual({
        [fixture.arquivo]: [],
      });
    }
  });

  it('todo fixture avisa no proprio conteudo que e ficticio', () => {
    // So os que carregam texto legivel. O HEIC e o PNG guardam a nota em
    // metadado, e os dois casos de recusa nao precisam ser lidos por ninguem.
    for (const arquivo of [
      'rg-frente.jpeg',
      'rg-reenvio.jpeg',
      'procuracao-registro-casa.pdf',
      'contracheque-2026-07.pdf',
    ]) {
      expect(noDisco(arquivo).toString('latin1').toUpperCase()).toContain('FICTICIO');
    }
  });
});
