import { CampoExtraido } from '../../src/dominio/documento/campo-extraido.entidade';
import { Confianca } from '../../src/dominio/documento/confianca.vo';
import { PoliticaDeNomenclatura } from '../../src/dominio/documento/politica-de-nomenclatura';
import { TipoDocumento } from '../../src/dominio/documento/tipo-documento';

const politica = new PoliticaDeNomenclatura();
const RG = TipoDocumento.de({
  codigo: 'RG',
  templateNome: '{tipo}_{nome}_{numero}_{data}.{extensao}',
  camposObrigatorios: ['nome', 'numero'],
});
const DATA = new Date('2026-08-31T12:00:00Z');
const campo = (nome: string, valor: string) =>
  CampoExtraido.doModelo(nome, valor, Confianca.de(0.95));

describe('normalizacao do valor', () => {
  const n = PoliticaDeNomenclatura.normalizar;

  it('remove acento sem perder a letra', () => {
    expect(n('MARIA JOSÉ DA CONCEIÇÃO')).toBe('MARIA_JOSE_DA_CONCEICAO');
    expect(n('João Ñuñez')).toBe('JOAO_NUNEZ');
  });

  // Os valores vem de extracao sobre foto, entao chegam assim.
  it('colapsa espaco duplo, tabulacao e quebra de linha em um separador', () => {
    expect(n('João  Ferreira\nda\tSilva')).toBe('JOAO_FERREIRA_DA_SILVA');
  });

  it('descarta caractere que nao pode compor nome de arquivo', () => {
    expect(n('Maria/Silva\\Souza:*?"<>|')).toBe('MARIASILVASOUZA');
    expect(n('../../etc/passwd')).toBe('ETCPASSWD');
  });

  it('preserva o hifen, porque data e competencia dependem dele', () => {
    expect(n('2026-08-31')).toBe('2026-08-31');
    expect(n('2026-07')).toBe('2026-07');
  });

  it('nao deixa separador solto no comeco nem no fim', () => {
    expect(n('  _Maria_  ')).toBe('MARIA');
  });

  it('trunca em 40 caracteres sem deixar separador na ponta', () => {
    const resultado = n('A'.repeat(38) + ' BBBB');
    expect(resultado.length).toBeLessThanOrEqual(40);
    expect(resultado.endsWith('_')).toBe(false);
  });

  // Valor que nao sobrevive a normalizacao e valor que nao veio.
  it.each(['...///', '   ', '?!@#$'])('devolve vazio para %j', (valor) => {
    expect(n(valor)).toBe('');
  });
});

describe('formatacao da data', () => {
  // Formatar no fuso do processo faria o mesmo documento receber nomes
  // diferentes conforme a maquina em que o worker rodasse.
  it('usa UTC e nao o fuso local', () => {
    expect(PoliticaDeNomenclatura.formatarData(new Date('2026-08-31T23:30:00Z'))).toBe('2026-08-31');
    expect(PoliticaDeNomenclatura.formatarData(new Date('2026-01-05T00:00:00Z'))).toBe('2026-01-05');
  });
});

describe('montagem do nome', () => {
  it('monta o nome do exemplo da especificacao', () => {
    const resultado = politica.montar({
      tipo: RG,
      campos: [campo('nome', 'Maria da Silva'), campo('numero', '123456789')],
      data: DATA,
      extensao: 'jpg',
    });
    expect(resultado).toEqual({ montou: true, nome: 'RG_MARIA_DA_SILVA_123456789_2026-08-31.jpg' });
  });

  it('mantem a extensao em minusculo', () => {
    const resultado = politica.montar({
      tipo: RG,
      campos: [campo('nome', 'Maria'), campo('numero', '1')],
      data: DATA,
      extensao: '.JPEG',
    });
    expect(resultado).toMatchObject({ montou: true, nome: expect.stringMatching(/\.jpeg$/) });
  });

  it('nao monta nome incompleto quando falta campo, e diz qual marcador', () => {
    const resultado = politica.montar({
      tipo: RG,
      campos: [campo('nome', 'Maria da Silva')],
      data: DATA,
      extensao: 'jpg',
    });
    expect(resultado).toEqual({ montou: false, marcadoresSemValor: ['numero'] });
  });

  // O campo veio, com confianca alta, e mesmo assim nao da para montar o nome.
  // E o unico caso em que este motivo aparece sozinho.
  it('trata valor que nao sobrevive a normalizacao como valor ausente', () => {
    const resultado = politica.montar({
      tipo: RG,
      campos: [campo('nome', 'Maria'), campo('numero', '...///')],
      data: DATA,
      extensao: 'jpg',
    });
    expect(resultado).toEqual({ montou: false, marcadoresSemValor: ['numero'] });
  });

  // O nome nunca deriva do que veio do celular. Fato (b).
  it('ignora qualquer campo chamado como um marcador embutido', () => {
    const resultado = politica.montar({
      tipo: RG,
      campos: [campo('nome', 'Maria'), campo('numero', '1'), campo('tipo', 'INVENTADO')],
      data: DATA,
      extensao: 'jpg',
    });
    expect(resultado).toEqual({ montou: true, nome: 'RG_MARIA_1_2026-08-31.jpg' });
  });

  it('trunca o nome inteiro preservando a extensao', () => {
    const tipoLongo = TipoDocumento.de({
      codigo: 'RG',
      templateNome: '{tipo}_{a}_{b}_{c}_{d}_{e}_{f}.{extensao}',
      camposObrigatorios: ['a', 'b', 'c', 'd', 'e', 'f'],
    });
    const campos = ['a', 'b', 'c', 'd', 'e', 'f'].map((n) => campo(n, 'X'.repeat(60)));
    const resultado = politica.montar({ tipo: tipoLongo, campos, data: DATA, extensao: 'jpeg' });

    expect(resultado.montou).toBe(true);
    if (!resultado.montou) return;
    expect(resultado.nome.length).toBeLessThanOrEqual(200);
    expect(resultado.nome.endsWith('.jpeg')).toBe(true);
  });
});
