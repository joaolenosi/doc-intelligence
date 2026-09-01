import {
  SituacaoDocumento,
  ehTerminal,
  garantirTransicao,
  podeTransitar,
} from '../../src/dominio/documento/situacao-documento';

const TODAS = Object.values(SituacaoDocumento);

describe('maquina de situacoes', () => {
  it('sai de RECEIVED so para PROCESSING ou REJECTED', () => {
    expect(podeTransitar(SituacaoDocumento.RECEIVED, SituacaoDocumento.PROCESSING)).toBe(true);
    expect(podeTransitar(SituacaoDocumento.RECEIVED, SituacaoDocumento.REJECTED)).toBe(true);
    expect(podeTransitar(SituacaoDocumento.RECEIVED, SituacaoDocumento.PROCESSED)).toBe(false);
  });

  // Um documento que reprova na validacao nunca chegou a custar uma chamada, e
  // um que falhou no extrator custou ate tres. Se REJECTED fosse alcancavel a
  // partir de PROCESSING, a conta de custo por situacao passaria a mentir.
  it('nao alcanca REJECTED depois que o processamento comecou', () => {
    expect(podeTransitar(SituacaoDocumento.PROCESSING, SituacaoDocumento.REJECTED)).toBe(false);
  });

  // Falha transitoria devolve o trabalho para a fila sem mudar a situacao.
  it('permite PROCESSING para PROCESSING, que e a retentativa do fato (a)', () => {
    expect(podeTransitar(SituacaoDocumento.PROCESSING, SituacaoDocumento.PROCESSING)).toBe(true);
  });

  it('trata PROCESSED, REVIEW_REQUIRED, FAILED e REJECTED como terminais', () => {
    expect(ehTerminal(SituacaoDocumento.PROCESSED)).toBe(true);
    expect(ehTerminal(SituacaoDocumento.REVIEW_REQUIRED)).toBe(true);
    expect(ehTerminal(SituacaoDocumento.FAILED)).toBe(true);
    expect(ehTerminal(SituacaoDocumento.REJECTED)).toBe(true);
    expect(ehTerminal(SituacaoDocumento.RECEIVED)).toBe(false);
  });

  // Documento em estado terminal nao pode ser reaberto por caminho nenhum. O
  // reprocessamento manual esta declarado como nao implementado, e se ele
  // existir um dia vai precisar de transicao propria e explicita.
  it('nao deixa nenhum terminal voltar para lugar nenhum', () => {
    const terminais = TODAS.filter(ehTerminal);
    for (const terminal of terminais) {
      for (const destino of TODAS) {
        expect(podeTransitar(terminal, destino)).toBe(false);
      }
    }
  });

  it('garantirTransicao passa no valido e falha no invalido, dizendo qual foi', () => {
    expect(() =>
      garantirTransicao(SituacaoDocumento.PROCESSING, SituacaoDocumento.PROCESSED),
    ).not.toThrow();

    expect(() =>
      garantirTransicao(SituacaoDocumento.PROCESSED, SituacaoDocumento.PROCESSING),
    ).toThrow(/PROCESSED para PROCESSING/);
  });

  it('conhece exatamente as seis situacoes do CHECK da migration', () => {
    expect(TODAS.sort()).toEqual(
      ['FAILED', 'PROCESSED', 'PROCESSING', 'RECEIVED', 'REJECTED', 'REVIEW_REQUIRED'],
    );
  });
});
