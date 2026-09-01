import { esperaAntesDeRetentar } from '../../src/infraestrutura/fila/nome-da-fila';

/**
 * A funcao de espera nao tinha teste nenhum, e ela passou a valer para os dois
 * adaptadores de fila. Enquanto so o adaptador de Postgres a usava, o custo de
 * mudar sem perceber era baixo. Agora ela decide a espera do caminho padrao
 * tambem, entao o contrato dela precisa estar escrito em algum lugar que falhe.
 *
 * O contrato tem duas partes, e as duas importam por motivos diferentes. A base
 * precisa continuar sendo a mesma progressao que o `exponential` nativo do
 * BullMQ dava com `delay: 2000`, porque foi ela que substituiu, e uma troca que
 * mudasse a espera em silencio nao seria refatoracao. O jitter precisa continuar
 * existindo, porque ele e a unica razao de nao ter ficado no nativo.
 */
const comRandomFixo = <T>(valor: number, executar: () => T): T => {
  const original = Math.random;
  Math.random = () => valor;
  try {
    return executar();
  } finally {
    Math.random = original;
  }
};

describe('esperaAntesDeRetentar', () => {
  /**
   * `Math.random()` em 0,5 zera o jitter, porque o fator vira exatamente 1. E o
   * jeito de ver a base sem o ruido em cima dela.
   */
  it('mantem a progressao que o exponential do BullMQ dava com delay 2000', () => {
    comRandomFixo(0.5, () => {
      expect(esperaAntesDeRetentar(1)).toBe(2000);
      expect(esperaAntesDeRetentar(2)).toBe(4000);
      expect(esperaAntesDeRetentar(3)).toBe(8000);
    });
  });

  /**
   * A primeira espera parte da tentativa 1, e nao da 0. E o mesmo significado do
   * `attemptsMade` que o BullMQ passa para a estrategia customizada, e e o que
   * permite passar um direto no outro em `criarConsumidorBullMq`. Um erro de um
   * aqui dobraria ou dividiria toda a progressao pela metade, sem quebrar nada
   * que aparecesse.
   */
  it('conta a tentativa que acabou de falhar, entao comeca em 2000', () => {
    comRandomFixo(0.5, () => expect(esperaAntesDeRetentar(1)).toBe(2000));
  });

  it('espalha a espera em torno da base, entre 75% e 125%', () => {
    comRandomFixo(0, () => expect(esperaAntesDeRetentar(1)).toBe(1500));
    // 2499, e nao 2500, porque `Math.random()` nunca devolve 1: o topo da banda
    // e aberto. O valor exato importa menos do que a banda, que o teste de
    // amostragem abaixo cobre com o gerador de verdade.
    comRandomFixo(0.999, () => expect(esperaAntesDeRetentar(1)).toBe(2499));
  });

  /**
   * A assercao que sustenta a decisao inteira: se alguem trocar esta funcao pelo
   * `exponential` nativo de novo, dois documentos que falham no mesmo segundo
   * voltam no mesmo instante. O teste compara os extremos do jitter em vez de
   * amostrar `Math.random`, para nao depender de sorte.
   */
  it('nao devolve sempre o mesmo valor para a mesma tentativa', () => {
    const menor = comRandomFixo(0, () => esperaAntesDeRetentar(2));
    const maior = comRandomFixo(0.999, () => esperaAntesDeRetentar(2));
    expect(menor).toBeLessThan(maior);
  });

  it('nunca sai da banda, com o Math.random de verdade', () => {
    for (let tentativa = 1; tentativa <= 4; tentativa += 1) {
      const base = 2000 * 2 ** (tentativa - 1);
      for (let amostra = 0; amostra < 200; amostra += 1) {
        const espera = esperaAntesDeRetentar(tentativa);
        expect(espera).toBeGreaterThanOrEqual(base * 0.75);
        expect(espera).toBeLessThanOrEqual(base * 1.25);
      }
    }
  });
});
