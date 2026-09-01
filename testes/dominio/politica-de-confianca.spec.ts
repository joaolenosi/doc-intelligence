import { CampoExtraido } from '../../src/dominio/documento/campo-extraido.entidade';
import { Confianca } from '../../src/dominio/documento/confianca.vo';
import { PoliticaDeConfianca } from '../../src/dominio/documento/politica-de-confianca';
import { SituacaoDocumento } from '../../src/dominio/documento/situacao-documento';
import { TipoDocumento } from '../../src/dominio/documento/tipo-documento';

const LIMIARES = { tipo: Confianca.de(0.8), campo: Confianca.de(0.85) };
const politica = new PoliticaDeConfianca(LIMIARES);

const RG = TipoDocumento.de({
  codigo: 'RG',
  templateNome: '{tipo}_{nome}_{numero}_{data}.{extensao}',
  camposObrigatorios: ['nome', 'filiacao', 'dataNascimento', 'numero', 'orgaoEmissor'],
});

const campo = (nome: string, confianca: number) =>
  CampoExtraido.doModelo(nome, `VALOR FICTICIO DE ${nome}`, Confianca.de(confianca));

const rgCompleto = (confiancas: Partial<Record<string, number>> = {}) =>
  RG.camposObrigatorios.map((nome) => campo(nome, confiancas[nome] ?? 0.97));

const textos = (motivos: readonly { paraTexto(): string }[]) => motivos.map((m) => m.paraTexto());

describe('PoliticaDeConfianca', () => {
  it('aprova quando o tipo e todos os obrigatorios estao acima do limiar', () => {
    const decisao = politica.decidir({
      tipo: RG,
      confiancaTipo: Confianca.de(0.94),
      campos: rgCompleto(),
    });
    expect(decisao.situacao).toBe(SituacaoDocumento.PROCESSED);
    expect(decisao.motivos).toEqual([]);
  });

  /**
   * Este e o teste que justifica o ADR-007. Com confianca agregada, a media
   * deste documento passa de 0,85 e ele entraria como pronto com o numero da
   * identidade quase certamente errado.
   */
  it('para o documento por um campo ruim, mesmo com media alta', () => {
    const campos = rgCompleto({ numero: 0.4 });
    const media = campos.reduce((s, c) => s + c.confianca.valor, 0) / campos.length;
    expect(media).toBeGreaterThan(LIMIARES.campo.valor);

    const decisao = politica.decidir({ tipo: RG, confiancaTipo: Confianca.de(0.94), campos });
    expect(decisao.situacao).toBe(SituacaoDocumento.REVIEW_REQUIRED);
    expect(textos(decisao.motivos)).toEqual(['CONFIANCA_CAMPO_BAIXA:numero']);
  });

  it('para quando a confianca do tipo esta abaixo do limiar', () => {
    const decisao = politica.decidir({
      tipo: RG,
      confiancaTipo: Confianca.de(0.79),
      campos: rgCompleto(),
    });
    expect(textos(decisao.motivos)).toEqual(['CONFIANCA_TIPO_BAIXA']);
  });

  it('para quando falta campo obrigatorio, dizendo qual', () => {
    const campos = rgCompleto().filter((c) => c.nome !== 'orgaoEmissor');
    const decisao = politica.decidir({ tipo: RG, confiancaTipo: Confianca.de(0.94), campos });
    expect(textos(decisao.motivos)).toEqual(['CAMPO_OBRIGATORIO_AUSENTE:orgaoEmissor']);
  });

  it('nao reclama de campo extra que nao e obrigatorio', () => {
    const campos = [...rgCompleto(), campo('observacao', 0.1)];
    const decisao = politica.decidir({ tipo: RG, confiancaTipo: Confianca.de(0.94), campos });
    expect(decisao.situacao).toBe(SituacaoDocumento.PROCESSED);
  });

  // Tipo fora do catalogo e precisamente o caso em que o sistema nao deveria
  // decidir sozinho, entao a confianca informada nao salva.
  it('para em DESCONHECIDO mesmo com confianca alta', () => {
    const desconhecido = TipoDocumento.de({
      codigo: 'DESCONHECIDO',
      templateNome: '{tipo}_{data}.{extensao}',
      camposObrigatorios: [],
    });
    const decisao = politica.decidir({
      tipo: desconhecido,
      confiancaTipo: Confianca.de(1),
      campos: [],
    });
    expect(textos(decisao.motivos)).toEqual(['TIPO_DESCONHECIDO']);
  });

  it('para quando o template do catalogo esta mal configurado', () => {
    const malConfigurado = TipoDocumento.de({
      codigo: 'RG',
      templateNome: '{tipo}_{apelido}.{extensao}',
      camposObrigatorios: ['nome'],
    });
    const decisao = politica.decidir({
      tipo: malConfigurado,
      confiancaTipo: Confianca.de(0.99),
      campos: [campo('nome', 0.99)],
    });
    expect(textos(decisao.motivos)).toEqual(['CATALOGO_INVALIDO']);
  });

  // A lista vai para o banco e para a resposta. Ordem que muda entre execucoes
  // tornaria qualquer comparacao inutil.
  it('acumula os motivos em ordem estavel', () => {
    const campos = rgCompleto({ numero: 0.4 }).filter((c) => c.nome !== 'filiacao');
    const decisao = politica.decidir({ tipo: RG, confiancaTipo: Confianca.de(0.5), campos });
    expect(textos(decisao.motivos)).toEqual([
      'CONFIANCA_TIPO_BAIXA',
      'CAMPO_OBRIGATORIO_AUSENTE:filiacao',
      'CONFIANCA_CAMPO_BAIXA:numero',
    ]);
  });

  it('trata o limiar como inclusivo: exatamente no limiar passa', () => {
    const decisao = politica.decidir({
      tipo: RG,
      confiancaTipo: Confianca.de(0.8),
      campos: rgCompleto({ numero: 0.85 }),
    });
    expect(decisao.situacao).toBe(SituacaoDocumento.PROCESSED);
  });
});
