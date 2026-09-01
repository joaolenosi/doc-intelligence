import { CampoExtraido } from '../../src/dominio/documento/campo-extraido.entidade';
import { ChaveArmazenamento } from '../../src/dominio/documento/chave-armazenamento.vo';
import { Confianca } from '../../src/dominio/documento/confianca.vo';
import { Documento } from '../../src/dominio/documento/documento.entidade';
import { HashConteudo } from '../../src/dominio/documento/hash-conteudo.vo';
import { PoliticaDeConfianca } from '../../src/dominio/documento/politica-de-confianca';
import { PoliticaDeNomenclatura } from '../../src/dominio/documento/politica-de-nomenclatura';
import { SituacaoDocumento } from '../../src/dominio/documento/situacao-documento';
import { TipoDocumento } from '../../src/dominio/documento/tipo-documento';

const AGORA = new Date('2026-08-31T12:00:00Z');
const politicaConfianca = new PoliticaDeConfianca({
  tipo: Confianca.de(0.8),
  campo: Confianca.de(0.85),
});
const politicaNome = new PoliticaDeNomenclatura();

const RG = TipoDocumento.de({
  codigo: 'RG',
  templateNome: '{tipo}_{nome}_{numero}_{data}.{extensao}',
  camposObrigatorios: ['nome', 'numero'],
});

const receber = () =>
  Documento.receber({
    hash: HashConteudo.de('a'.repeat(64)),
    chaveArmazenamento: ChaveArmazenamento.de('3f2504e0-4f89-41d3-9a0c-0305e82c3301'),
    tipoMidia: 'image/jpeg',
    tamanhoBytes: 2481003,
    agora: AGORA,
  });

const campo = (nome: string, valor: string, confianca: number) =>
  CampoExtraido.doModelo(nome, valor, Confianca.de(confianca));

/** Roda as duas politicas e conclui, que e o que o caso de uso vai fazer. */
const concluirCom = (documento: Documento, campos: CampoExtraido[], confiancaTipo = 0.94) => {
  const entrada = { tipo: RG, confiancaTipo: Confianca.de(confiancaTipo), campos };
  documento.concluirExtracao({
    ...entrada,
    decisao: politicaConfianca.decidir(entrada),
    nome: politicaNome.montar({ tipo: RG, campos, data: AGORA, extensao: 'jpg' }),
    agora: AGORA,
  });
};

describe('Documento', () => {
  it('nasce em RECEIVED, e a resposta do upload sai antes de qualquer chamada', () => {
    const documento = receber();
    expect(documento.situacao).toBe(SituacaoDocumento.RECEIVED);
    expect(documento.nomeSugerido).toBeUndefined();
    expect(documento.motivosRevisao).toEqual([]);
  });

  it('recusa nascer sem conteudo', () => {
    expect(() =>
      Documento.receber({
        hash: HashConteudo.de('a'.repeat(64)),
        chaveArmazenamento: ChaveArmazenamento.de('3f2504e0-4f89-41d3-9a0c-0305e82c3301'),
        tipoMidia: 'image/jpeg',
        tamanhoBytes: 0,
        agora: AGORA,
      }),
    ).toThrow(/sem conteudo/);
  });

  it('conclui em PROCESSED com nome montado quando tudo esta acima do limiar', () => {
    const documento = receber();
    documento.iniciarProcessamento(AGORA);
    concluirCom(documento, [campo('nome', 'Maria da Silva', 0.96), campo('numero', '123456789', 0.95)]);

    expect(documento.situacao).toBe(SituacaoDocumento.PROCESSED);
    expect(documento.nomeSugerido).toBe('RG_MARIA_DA_SILVA_123456789_2026-08-31.jpg');
    expect(documento.motivosParaTexto()).toEqual([]);
    expect(documento.processadoEm).toEqual(AGORA);
  });

  it('conclui em REVIEW_REQUIRED e nao gera nome quando a confianca de um campo cai', () => {
    const documento = receber();
    documento.iniciarProcessamento(AGORA);
    concluirCom(documento, [campo('nome', 'Maria da Silva', 0.96), campo('numero', '123456789', 0.4)]);

    expect(documento.situacao).toBe(SituacaoDocumento.REVIEW_REQUIRED);
    expect(documento.motivosParaTexto()).toEqual(['CONFIANCA_CAMPO_BAIXA:numero']);
    // O nome continua preenchido, e isso e deliberado: ele foi montavel, e a
    // pessoa que vai conferir precisa ver a proposta para julgar. O nome so
    // fica nulo quando nao deu para monta-lo.
    expect(documento.nomeSugerido).toBe('RG_MARIA_DA_SILVA_123456789_2026-08-31.jpg');
  });

  /**
   * O unico caso em que as duas politicas divergem: o campo veio, com confianca
   * alta, e o valor nao sobreviveu a normalizacao.
   */
  it('acrescenta NOME_INCOMPLETO quando o valor nao sobrevive a normalizacao', () => {
    const documento = receber();
    documento.iniciarProcessamento(AGORA);
    concluirCom(documento, [campo('nome', 'Maria da Silva', 0.96), campo('numero', '...///', 0.99)]);

    expect(documento.situacao).toBe(SituacaoDocumento.REVIEW_REQUIRED);
    expect(documento.motivosParaTexto()).toEqual(['NOME_INCOMPLETO:numero']);
    expect(documento.nomeSugerido).toBeUndefined();
  });

  it('acumula motivo de confianca e de nome quando os dois valem', () => {
    const documento = receber();
    documento.iniciarProcessamento(AGORA);
    concluirCom(documento, [campo('nome', 'Maria da Silva', 0.96)]);

    expect(documento.motivosParaTexto()).toEqual([
      'CAMPO_OBRIGATORIO_AUSENTE:numero',
      'NOME_INCOMPLETO:numero',
    ]);
  });

  describe('transicoes', () => {
    it('nao processa documento que ja foi rejeitado', () => {
      const documento = receber();
      documento.rejeitar(AGORA);
      expect(() => documento.iniciarProcessamento(AGORA)).toThrow(/REJECTED para PROCESSING/);
    });

    it('nao rejeita documento que ja comecou a processar', () => {
      const documento = receber();
      documento.iniciarProcessamento(AGORA);
      expect(() => documento.rejeitar(AGORA)).toThrow(/PROCESSING para REJECTED/);
    });

    it('permite falha transitoria seguida de conclusao, que e a retentativa', () => {
      const documento = receber();
      documento.iniciarProcessamento(AGORA);
      documento.registrarFalhaTransitoria(AGORA);
      documento.registrarFalhaTransitoria(AGORA);
      expect(documento.situacao).toBe(SituacaoDocumento.PROCESSING);
      expect(() => documento.falhar(AGORA)).not.toThrow();
    });

    it('nao reabre documento que terminou', () => {
      const documento = receber();
      documento.iniciarProcessamento(AGORA);
      documento.falhar(AGORA);
      expect(() => documento.iniciarProcessamento(AGORA)).toThrow(/FAILED para PROCESSING/);
    });
  });

  // Fato (d). O nome sugerido carrega nome de pessoa e parece identificador
  // tecnico, entao nao pode sair por interpolacao descuidada.
  it('nao expoe o nome sugerido quando convertido para texto', () => {
    const documento = receber();
    documento.iniciarProcessamento(AGORA);
    concluirCom(documento, [campo('nome', 'Maria da Silva', 0.96), campo('numero', '123456789', 0.95)]);

    const texto = `${documento}`;
    expect(texto).toBe('Documento(novo, PROCESSED)');
    expect(texto).not.toContain('MARIA');
  });
});
