import { ArquivoRecusado } from '../../src/aplicacao/erros/erros-de-aplicacao';
import {
  ReceberDocumento,
  EntradaDeRecebimento,
} from '../../src/aplicacao/casos-de-uso/receber-documento.caso-de-uso';
import { SituacaoDocumento } from '../../src/dominio/documento/situacao-documento';
import {
  ArmazenamentoEmMemoria,
  DocumentosEmMemoria,
  HashFake,
  InspetorFake,
  PublicadorEmMemoria,
  RelogioFixo,
  SubmissoesEmMemoria,
  UnidadeDeTrabalhoDireta,
} from './dubles';

const conteudo = (texto: string) => new TextEncoder().encode(texto);

const montar = () => {
  const documentos = new DocumentosEmMemoria();
  const submissoes = new SubmissoesEmMemoria();
  const armazenamento = new ArmazenamentoEmMemoria();
  const publicador = new PublicadorEmMemoria();
  const inspetor = new InspetorFake();
  const caso = new ReceberDocumento({
    documentos,
    submissoes,
    armazenamento,
    inspetor,
    hash: new HashFake(),
    publicador,
    unidadeDeTrabalho: new UnidadeDeTrabalhoDireta(),
    relogio: new RelogioFixo(),
    configuracao: { tamanhoMaximoBytes: 25 * 1024 * 1024 },
  });
  return { caso, documentos, submissoes, armazenamento, publicador, inspetor };
};

const envio = (sobrescreve: Partial<EntradaDeRecebimento> = {}): EntradaDeRecebimento => ({
  conteudo: conteudo('bytes ficticios de um RG'),
  nomeOriginal: 'WhatsApp Image 2026-08-11 at 09.12.33.jpeg',
  sistemaOrigem: 'crm-atendimento',
  ...sobrescreve,
});

describe('ReceberDocumento', () => {
  it('cria o documento em RECEIVED e publica o trabalho, sem esperar o modelo', async () => {
    const { caso, publicador, armazenamento } = montar();

    const saida = await caso.executar(envio());

    expect(saida.criado).toBe(true);
    expect(saida.documento.situacao).toBe(SituacaoDocumento.RECEIVED);
    expect(publicador.publicados).toEqual([saida.documento.id]);
    expect(armazenamento.arquivos.size).toBe(1);
  });

  /**
   * Este e o teste que prova o fato (c) e o custo do fato (a). O mesmo conteudo
   * chega tres vezes, com nome diferente e por canais diferentes, e o sistema
   * cria um documento so, guarda um arquivo so e publica um trabalho so.
   */
  describe('reenvio do mesmo conteudo', () => {
    it('cria um documento so, guarda um arquivo so e publica uma vez so', async () => {
      const { caso, armazenamento, publicador } = montar();
      const bytes = conteudo('o mesmo RG fotografado uma vez');

      const primeiro = await caso.executar(envio({ conteudo: bytes }));
      const segundo = await caso.executar(
        envio({ conteudo: bytes, nomeOriginal: 'scan0001.pdf', sistemaOrigem: 'portal-balcao' }),
      );
      const terceiro = await caso.executar(
        envio({ conteudo: bytes, nomeOriginal: 'IMG_0042.jpg' }),
      );

      expect(primeiro.criado).toBe(true);
      expect(segundo.criado).toBe(false);
      expect(terceiro.criado).toBe(false);
      expect(segundo.documento.id).toBe(primeiro.documento.id);
      expect(terceiro.documento.id).toBe(primeiro.documento.id);

      expect(armazenamento.arquivos.size).toBe(1);
      expect(publicador.publicados).toEqual([primeiro.documento.id]);
    });

    // O 200 nao significa "nao fiz nada". Ver ADR-006.
    it('registra uma submissao por envio, com o nome e o canal de cada um', async () => {
      const { caso, submissoes } = montar();
      const bytes = conteudo('o mesmo RG fotografado uma vez');

      await caso.executar(envio({ conteudo: bytes }));
      await caso.executar(
        envio({ conteudo: bytes, nomeOriginal: 'scan0001.pdf', sistemaOrigem: 'portal-balcao' }),
      );

      const resumo = await submissoes.resumoPorDocumento(1);
      expect(resumo.total).toBe(2);
      expect(resumo.canais).toEqual(['crm-atendimento', 'portal-balcao']);
      expect(resumo.nomeOriginalMaisRecente).toBe('scan0001.pdf');
    });
  });

  describe('idempotencia de requisicao', () => {
    // A mesma requisicao repetida por timeout de rede nao pode virar duas
    // submissoes. E problema diferente do reenvio, e tem mecanismo diferente.
    it('nao cria submissao nova quando a mesma chave chega do mesmo sistema', async () => {
      const { caso, submissoes } = montar();
      const entrada = envio({ chaveIdempotencia: 'req-1' });

      await caso.executar(entrada);
      const repetida = await caso.executar(entrada);

      expect(repetida.criado).toBe(false);
      expect(submissoes.registros).toHaveLength(1);
    });

    // Dois sistemas internos geram identificador sem coordenacao entre si. Se a
    // unicidade fosse global, o segundo teria o envio descartado em silencio.
    it('trata a mesma chave de sistemas diferentes como envios diferentes', async () => {
      const { caso, submissoes } = montar();
      const bytes = conteudo('mesmo conteudo');

      await caso.executar(envio({ conteudo: bytes, chaveIdempotencia: 'req-1' }));
      await caso.executar(
        envio({ conteudo: bytes, chaveIdempotencia: 'req-1', sistemaOrigem: 'portal-balcao' }),
      );

      expect(submissoes.registros).toHaveLength(2);
    });
  });

  describe('validacao antes de qualquer custo', () => {
    it.each([
      ['vazio', new Uint8Array(0), 'ARQUIVO_VAZIO'],
      ['acima do limite', new Uint8Array(26 * 1024 * 1024), 'TAMANHO_EXCEDIDO'],
    ])('recusa arquivo %s', async (_caso, bytes, codigo) => {
      const { caso, documentos, armazenamento } = montar();

      await expect(caso.executar(envio({ conteudo: bytes }))).rejects.toMatchObject({ codigo });
      expect(armazenamento.arquivos.size).toBe(0);
      expect(await documentos.buscarPorId(1)).toBeUndefined();
    });

    // O tipo sai dos bytes, nunca do que o cliente informou. Fato (b).
    it('recusa por inspecao de conteudo e nao grava nada', async () => {
      const { caso, inspetor, armazenamento } = montar();
      inspetor.definirTipo('application/x-msdownload');

      await expect(
        caso.executar(envio({ tipoMidiaInformado: 'application/pdf' })),
      ).rejects.toBeInstanceOf(ArquivoRecusado);
      expect(armazenamento.arquivos.size).toBe(0);
    });
  });

  // Duas requisicoes simultaneas passam as duas pela consulta por hash. O
  // indice unico recusa a segunda, e o reenvio e o comportamento esperado.
  it('trata a corrida no indice unico como reenvio, e nao como erro', async () => {
    const { caso, submissoes, publicador, armazenamento } = montar();
    const bytes = conteudo('conteudo em corrida');

    const [a, b] = await Promise.all([
      caso.executar(envio({ conteudo: bytes })),
      caso.executar(envio({ conteudo: bytes, nomeOriginal: 'outro.jpg' })),
    ]);

    expect([a.criado, b.criado].sort()).toEqual([false, true]);
    expect(a.documento.id).toBe(b.documento.id);
    // O que importa: uma chamada paga so, e os dois envios registrados.
    expect(publicador.publicados).toHaveLength(1);
    expect(submissoes.registros).toHaveLength(2);

    // O perdedor da corrida ja tinha gravado o arquivo quando perdeu, entao
    // sobra um arquivo orfao que nenhum documento referencia. Sistema de
    // arquivos nao participa de transacao, e apagar aqui exigiria uma operacao
    // de remocao na porta que nada mais usa. E vazamento de disco em caso raro,
    // e esta declarado em docs/escopo-nao-implementado.md com o desenho da
    // coleta. O teste afirma o comportamento atual em vez de esconde-lo.
    expect(armazenamento.arquivos.size).toBe(2);
  });
});
