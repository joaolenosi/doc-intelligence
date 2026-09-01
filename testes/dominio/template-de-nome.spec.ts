import { TemplateDeNome } from '../../src/dominio/documento/template-de-nome';

const valores = (entradas: Record<string, string>) => new Map(Object.entries(entradas));

describe('TemplateDeNome', () => {
  describe('leitura', () => {
    it('reconhece os marcadores na ordem em que aparecem', () => {
      const template = TemplateDeNome.de('{tipo}_{nome}_{numero}_{data}.{extensao}');
      expect(template.marcadores).toEqual(['tipo', 'nome', 'numero', 'data', 'extensao']);
    });

    it.each([
      ['vazio', '   '],
      ['chave aberta sem fechar', '{tipo}_{nome.{extensao}'],
      ['chave fechada sem abrir', '{tipo}_nome}.{extensao}'],
      ['marcador com caractere invalido', '{tipo}_{nome-do-titular}.{extensao}'],
      ['sem marcador nenhum', 'documento.pdf'],
    ])('recusa template %s', (_caso, bruto) => {
      expect(() => TemplateDeNome.de(bruto)).toThrow();
    });
  });

  describe('validacao contra o tipo', () => {
    const template = TemplateDeNome.de('{tipo}_{nome}_{numero}_{data}.{extensao}');

    it('aceita marcador embutido e campo obrigatorio', () => {
      expect(template.marcadoresInvalidos(['nome', 'numero', 'orgaoEmissor'])).toEqual([]);
    });

    // Um template que dependa de campo opcional produziria nome incompleto como
    // comportamento rotineiro, que e exatamente o que se quer evitar.
    it('recusa marcador que nao e obrigatorio daquele tipo', () => {
      expect(template.marcadoresInvalidos(['nome'])).toEqual(['numero']);
    });
  });

  describe('montagem', () => {
    const template = TemplateDeNome.de('{tipo}_{nome}_{data}.{extensao}');

    it('substitui todos os marcadores quando ha valor para todos', () => {
      const resultado = template.render(
        valores({ tipo: 'RG', nome: 'MARIA_DA_SILVA', data: '2026-08-31', extensao: 'jpg' }),
      );
      expect(resultado).toEqual({ montou: true, nome: 'RG_MARIA_DA_SILVA_2026-08-31.jpg' });
    });

    it('nao monta nome incompleto, e diz qual marcador ficou sem valor', () => {
      const resultado = template.render(valores({ tipo: 'RG', data: '2026-08-31', extensao: 'jpg' }));
      expect(resultado).toEqual({ montou: false, marcadoresSemValor: ['nome'] });
    });

    // Valor que nao sobrevive a normalizacao chega aqui como string vazia, e
    // vale o mesmo que valor que nao veio.
    it('trata valor vazio como valor ausente', () => {
      const resultado = template.render(
        valores({ tipo: 'RG', nome: '', data: '2026-08-31', extensao: 'jpg' }),
      );
      expect(resultado).toEqual({ montou: false, marcadoresSemValor: ['nome'] });
    });

    it('lista cada marcador faltante uma vez so', () => {
      const repetido = TemplateDeNome.de('{nome}_{nome}_{tipo}.{extensao}');
      const resultado = repetido.render(valores({ tipo: 'RG', extensao: 'jpg' }));
      expect(resultado).toEqual({ montou: false, marcadoresSemValor: ['nome'] });
    });
  });
});
