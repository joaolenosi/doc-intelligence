import { ChaveArmazenamento } from '../../src/dominio/documento/chave-armazenamento.vo';
import { Submissao } from '../../src/dominio/submissao/submissao.entidade';

const AGORA = new Date('2026-08-31T12:00:00Z');

describe('Submissao', () => {
  it('guarda o nome que veio do celular, como veio', () => {
    const submissao = Submissao.registrar({
      nomeOriginal: 'WhatsApp Image 2026-08-11 at 09.12.33.jpeg',
      sistemaOrigem: 'crm-atendimento',
      criadoEm: AGORA,
    });
    expect(submissao.nomeOriginal).toBe('WhatsApp Image 2026-08-11 at 09.12.33.jpeg');
  });

  // Sem sistema de origem, dois sistemas internos que gerem `req-1` sem
  // coordenacao entre si atropelariam um ao outro, e o sintoma seria um envio
  // que sumiu sem erro nenhum. Ver ADR-006.
  it('recusa nascer sem sistema de origem', () => {
    expect(() =>
      Submissao.registrar({ nomeOriginal: 'a.jpg', sistemaOrigem: '   ', criadoEm: AGORA }),
    ).toThrow(/sistema de origem/);
  });

  it('trata chave de idempotencia em branco como ausente', () => {
    const semChave = Submissao.registrar({
      nomeOriginal: 'a.jpg',
      sistemaOrigem: 'crm',
      criadoEm: AGORA,
      chaveIdempotencia: '   ',
    });
    // Chave vazia gravada como string vazia colidiria com todas as outras
    // vazias do mesmo sistema no indice unico parcial.
    expect(semChave.chaveIdempotencia).toBeUndefined();
  });

  it('mede a divergencia entre o tipo informado e o real, que e o fato (b)', () => {
    const submissao = Submissao.registrar({
      nomeOriginal: 'scan0001.pdf',
      sistemaOrigem: 'portal-balcao',
      criadoEm: AGORA,
      tipoMidiaInformado: 'application/pdf',
    });
    expect(submissao.informouTipoDivergente('image/jpeg')).toBe(true);
    expect(submissao.informouTipoDivergente('application/pdf')).toBe(false);
  });
});

describe('ChaveArmazenamento', () => {
  it('aceita UUID e normaliza para minusculo', () => {
    expect(ChaveArmazenamento.de('3F2504E0-4F89-41D3-9A0C-0305E82C3301').valor).toBe(
      '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    );
  });

  // Esta e a fronteira onde path traversal entraria, porque a chave e o que
  // vira caminho no disco. A defesa nao e sanitizar, e nao aceitar.
  it.each(['../../etc/passwd', 'nome-do-arquivo', '', '3f2504e0-4f89-41d3-9a0c'])(
    'recusa %j',
    (valor) => {
      expect(() => ChaveArmazenamento.de(valor)).toThrow(/UUID/);
    },
  );
});
