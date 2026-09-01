import { TipoDocumento } from '../../src/dominio/documento/tipo-documento';

/**
 * Os cinco tipos abaixo sao copia do que a migration
 * 1788184800000-CriaCatalogoDeTipos semeia. Se alguem mudar um template la sem
 * olhar a regra do dominio, este teste quebra, que e o ponto: o catalogo e
 * editavel por SQL e nada impede uma linha malformada de entrar.
 */
const CATALOGO_SEMEADO = [
  { codigo: 'RG', templateNome: '{tipo}_{nome}_{numero}_{data}.{extensao}', camposObrigatorios: ['nome', 'filiacao', 'dataNascimento', 'numero', 'orgaoEmissor'] },
  { codigo: 'CPF', templateNome: '{tipo}_{nome}_{numero}_{data}.{extensao}', camposObrigatorios: ['nome', 'numero'] },
  { codigo: 'COMPROVANTE_RESIDENCIA', templateNome: '{tipo}_{titular}_{dataReferencia}.{extensao}', camposObrigatorios: ['titular', 'endereco', 'dataReferencia'] },
  { codigo: 'CONTRACHEQUE', templateNome: '{tipo}_{nome}_{competencia}.{extensao}', camposObrigatorios: ['nome', 'competencia', 'valorLiquido'] },
  { codigo: 'DESCONHECIDO', templateNome: '{tipo}_{data}.{extensao}', camposObrigatorios: [] },
];

describe('TipoDocumento', () => {
  it.each(CATALOGO_SEMEADO)('o tipo $codigo semeado tem template valido', (entrada) => {
    expect(TipoDocumento.de(entrada).catalogoValido).toBe(true);
  });

  it('marca como invalido o template que referencia campo nao obrigatorio', () => {
    const tipo = TipoDocumento.de({
      codigo: 'RG',
      templateNome: '{tipo}_{nome}_{apelido}.{extensao}',
      camposObrigatorios: ['nome', 'numero'],
    });
    expect(tipo.catalogoValido).toBe(false);
    expect(tipo.marcadoresInvalidos()).toEqual(['apelido']);
  });

  it('reconhece DESCONHECIDO, que existe para o tipo fora do catalogo', () => {
    const desconhecido = TipoDocumento.de(CATALOGO_SEMEADO[4]);
    expect(desconhecido.ehDesconhecido).toBe(true);
    expect(desconhecido.camposObrigatorios).toEqual([]);
    expect(TipoDocumento.de(CATALOGO_SEMEADO[0]).ehDesconhecido).toBe(false);
  });

  it('normaliza o codigo e nao repete campo obrigatorio', () => {
    const tipo = TipoDocumento.de({
      codigo: '  rg  ',
      templateNome: '{tipo}_{nome}.{extensao}',
      camposObrigatorios: ['nome', 'nome'],
    });
    expect(tipo.codigo).toBe('RG');
    expect(tipo.camposObrigatorios).toEqual(['nome']);
    expect(tipo.exigeCampo('nome')).toBe(true);
    expect(tipo.exigeCampo('numero')).toBe(false);
  });
});
