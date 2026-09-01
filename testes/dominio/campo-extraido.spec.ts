import { CampoExtraido, OrigemDoCampo } from '../../src/dominio/documento/campo-extraido.entidade';
import { Confianca } from '../../src/dominio/documento/confianca.vo';

describe('CampoExtraido', () => {
  it('guarda nome, valor e a confianca daquele valor', () => {
    const campo = CampoExtraido.doModelo('nome', '  MARIA DA SILVA  ', Confianca.de(0.96));
    expect(campo.nome).toBe('nome');
    expect(campo.valor).toBe('MARIA DA SILVA');
    expect(campo.confianca.valor).toBe(0.96);
    expect(campo.origem).toBe(OrigemDoCampo.MODELO);
  });

  // Deixar entrar criaria uma linha que satisfaz "o campo obrigatorio existe"
  // sem satisfazer "o campo obrigatorio tem valor", e o documento passaria
  // como pronto e vazio.
  it.each(['', '   ', '\n\t'])('recusa valor em branco (%j)', (valor) => {
    expect(() => CampoExtraido.doModelo('numero', valor, Confianca.de(0.9))).toThrow(
      /mesmo que nao ter vindo/,
    );
  });

  it('recusa campo sem nome', () => {
    expect(() => CampoExtraido.doModelo('  ', 'algo', Confianca.de(0.9))).toThrow();
  });

  it('da confianca 1 a correcao humana, que e a unica leitura verificada por pessoa', () => {
    const campo = CampoExtraido.daCorrecaoHumana('numero', '123456789');
    expect(campo.confianca.valor).toBe(1);
    expect(campo.origem).toBe(OrigemDoCampo.CORRECAO_HUMANA);
  });

  // Fato (d). Se alguem interpolar um campo numa string de log por descuido,
  // precisa sair o nome do campo e nao o dado da pessoa.
  it('nao expoe o valor quando convertido para texto', () => {
    const campo = CampoExtraido.doModelo('nome', 'MARIA DA SILVA', Confianca.de(0.96));
    const texto = `${campo}`;
    expect(texto).toBe('CampoExtraido(nome)');
    expect(texto).not.toContain('MARIA');
  });
});
