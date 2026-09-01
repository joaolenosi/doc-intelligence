import { QueryFailedError } from 'typeorm';
import { descreverErro, registrarFalha } from '../../src/infraestrutura/comum/descrever-erro';

/**
 * O valor abaixo simula o que o Postgres devolve numa violacao de restricao:
 * `detail` traz "Failing row contains (...)" com a linha inteira. Numa linha de
 * campo_extraido isso e dado pessoal, e numa de documento e o nome sugerido.
 *
 * Isto foi verificado contra o banco de verdade antes de virar teste, e nao
 * suposto: `message` nao carrega o valor, `detail` carrega.
 */
const erroDeBanco = () => {
  const driver = Object.assign(new Error('violates check constraint'), {
    code: '23514',
    constraint: 'ck_cae_confianca_faixa',
    detail:
      'Failing row contains (1, 1, nome, MARIA DA SILVA SOUZA, 1.500, MODELO, 2026-09-01).',
  });
  return new QueryFailedError('INSERT INTO campo_extraido ...', [], driver);
};

describe('descreverErro', () => {
  it('nao deixa o detalhe do banco sair, porque ele carrega a linha inteira', () => {
    const descrito = descreverErro(erroDeBanco());
    const serializado = JSON.stringify(descrito);

    expect(serializado).not.toContain('MARIA');
    expect(serializado).not.toContain('Failing row');
    expect(serializado).not.toContain('1.500');
  });

  // Codigo e restricao dizem mais para diagnostico do que a frase, e sao
  // comprovadamente livres de valor.
  it('preserva o que serve para diagnosticar', () => {
    expect(descreverErro(erroDeBanco())).toEqual({
      erro: 'QueryFailedError',
      codigo: '23514',
      restricao: 'ck_cae_confianca_faixa',
    });
  });

  it('mantem a mensagem de erro que nao veio do driver, porque ela e nossa', () => {
    const nosso = Object.assign(new Error('Extrator nao respondeu em 60000ms'), {
      name: 'FalhaTransitoriaDoExtrator',
      codigo: 'TIMEOUT',
    });
    expect(descreverErro(nosso)).toEqual({
      erro: 'FalhaTransitoriaDoExtrator',
      codigo: 'TIMEOUT',
      mensagem: 'Extrator nao respondeu em 60000ms',
    });
  });

  it.each([[null], [undefined], ['texto solto'], [42]])('aguenta %p sem quebrar', (valor) => {
    expect(() => descreverErro(valor)).not.toThrow();
  });

  /**
   * O teste que fecha o caso do fato (d) e do ADR-012: o nome sugerido carrega
   * nome de pessoa e parece identificador tecnico, entao ele precisa ser
   * barrado pelo mesmo caminho que barra o valor do campo.
   */
  it('nao deixa o nome sugerido sair pelo log', () => {
    const driver = Object.assign(new Error('violates check constraint'), {
      code: '23514',
      constraint: 'ck_doc_motivos_coerentes',
      detail:
        'Failing row contains (1, abc, uuid, image/jpeg, 100, PROCESSED, 1, 0.940, RG_MARIA_DA_SILVA_123456789_2026-08-31.jpg, ...).',
    });

    const escritas: string[] = [];
    const espiao = jest.spyOn(console, 'error').mockImplementation((linha) => {
      escritas.push(String(linha));
    });

    registrarFalha('falha_interna', new QueryFailedError('UPDATE documento ...', [], driver), {
      documentoId: 1,
    });
    espiao.mockRestore();

    expect(escritas.join('\n')).not.toContain('RG_MARIA');
    expect(escritas.join('\n')).toContain('ck_doc_motivos_coerentes');
    expect(escritas.join('\n')).toContain('"documentoId":1');
  });
});
