import { Confianca } from '../../src/dominio/documento/confianca.vo';
import { HashConteudo } from '../../src/dominio/documento/hash-conteudo.vo';

describe('Confianca', () => {
  it('aceita a faixa fechada de 0 a 1', () => {
    expect(Confianca.de(0).valor).toBe(0);
    expect(Confianca.de(1).valor).toBe(1);
    expect(Confianca.de(0.85).valor).toBe(0.85);
  });

  // Sem o tipo, qualquer um destes passaria e a comparacao com o limiar
  // devolveria uma resposta com cara de valida.
  it.each([1.5, -0.1, NaN, Infinity])('recusa %p', (valor) => {
    expect(() => Confianca.de(valor)).toThrow();
  });

  it('compara com o limiar sem ambiguidade na borda', () => {
    const limiar = Confianca.de(0.85);
    expect(Confianca.de(0.84).abaixoDe(limiar)).toBe(true);
    expect(Confianca.de(0.85).abaixoDe(limiar)).toBe(false);
    expect(Confianca.de(0.86).abaixoDe(limiar)).toBe(false);
  });
});

describe('HashConteudo', () => {
  const VALIDO = 'a'.repeat(64);

  it('aceita 64 caracteres hexadecimais e normaliza para minusculo', () => {
    expect(HashConteudo.de('A'.repeat(64)).valor).toBe(VALIDO);
    expect(HashConteudo.de(`  ${VALIDO}  `).valor).toBe(VALIDO);
  });

  it.each([['curto', 'a'.repeat(63)], ['longo', 'a'.repeat(65)], ['nao hex', 'z'.repeat(64)], ['vazio', '']])(
    'recusa hash %s',
    (_caso, valor) => {
      expect(() => HashConteudo.de(valor)).toThrow(/64 caracteres hexadecimais/);
    },
  );

  it('compara pelo valor, porque identidade e o conteudo e nao a instancia', () => {
    expect(HashConteudo.de(VALIDO).igualA(HashConteudo.de(VALIDO.toUpperCase()))).toBe(true);
    expect(HashConteudo.de(VALIDO).igualA(HashConteudo.de('b'.repeat(64)))).toBe(false);
  });
});
