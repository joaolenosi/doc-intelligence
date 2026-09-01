import { DataSource } from 'typeorm';
import { ConflitoDeHash } from '../../src/aplicacao/erros/erros-de-aplicacao';
import { CampoExtraido } from '../../src/dominio/documento/campo-extraido.entidade';
import { ChaveArmazenamento } from '../../src/dominio/documento/chave-armazenamento.vo';
import { Confianca } from '../../src/dominio/documento/confianca.vo';
import { Documento } from '../../src/dominio/documento/documento.entidade';
import { HashConteudo } from '../../src/dominio/documento/hash-conteudo.vo';
import { PoliticaDeConfianca } from '../../src/dominio/documento/politica-de-confianca';
import { SituacaoDocumento } from '../../src/dominio/documento/situacao-documento';
import { Submissao } from '../../src/dominio/submissao/submissao.entidade';
import { UnidadeDeTrabalhoTypeOrm } from '../../src/infraestrutura/persistencia/typeorm/contexto-transacional';
import { RegistroDeAuditoriaTypeOrm } from '../../src/infraestrutura/persistencia/typeorm/repositorios/auditoria.repositorio';
import { CatalogoDeTiposTypeOrm } from '../../src/infraestrutura/persistencia/typeorm/repositorios/catalogo.repositorio';
import { RepositorioDeDocumentoTypeOrm } from '../../src/infraestrutura/persistencia/typeorm/repositorios/documento.repositorio';
import { RegistroDeProcessamentoTypeOrm } from '../../src/infraestrutura/persistencia/typeorm/repositorios/processamento.repositorio';
import { RepositorioDeSubmissaoTypeOrm } from '../../src/infraestrutura/persistencia/typeorm/repositorios/submissao.repositorio';
import { RelogioDoSistema } from '../../src/infraestrutura/comum/relogio-do-sistema.adapter';
import { conectar, limpar } from './ambiente';

let ds: DataSource;
const relogio = new RelogioDoSistema();
let documentos: RepositorioDeDocumentoTypeOrm;
let submissoes: RepositorioDeSubmissaoTypeOrm;
let processamentos: RegistroDeProcessamentoTypeOrm;
let auditoria: RegistroDeAuditoriaTypeOrm;
let catalogo: CatalogoDeTiposTypeOrm;
let unidade: UnidadeDeTrabalhoTypeOrm;

beforeAll(async () => {
  ds = await conectar();
  documentos = new RepositorioDeDocumentoTypeOrm(ds, relogio);
  submissoes = new RepositorioDeSubmissaoTypeOrm(ds);
  processamentos = new RegistroDeProcessamentoTypeOrm(ds, relogio);
  auditoria = new RegistroDeAuditoriaTypeOrm(ds, relogio);
  catalogo = new CatalogoDeTiposTypeOrm(ds);
  unidade = new UnidadeDeTrabalhoTypeOrm(ds);
});
afterAll(async () => {
  if (ds?.isInitialized) await ds.destroy();
});
beforeEach(() => limpar(ds));

const novoDocumento = (hash = 'a') =>
  Documento.receber({
    hash: HashConteudo.de(hash.repeat(64)),
    chaveArmazenamento: ChaveArmazenamento.de('3f2504e0-4f89-41d3-9a0c-0305e82c3301'),
    tipoMidia: 'image/jpeg',
    tamanhoBytes: 2481003,
    agora: new Date(),
  });

describe('persistencia contra Postgres de verdade', () => {
  it('grava e le o documento sem perder nada no caminho de ida e volta', async () => {
    const salvo = await documentos.salvar(novoDocumento());
    const lido = await documentos.buscarPorId(salvo.id as number);

    expect(lido?.hash.valor).toBe('a'.repeat(64));
    expect(lido?.chaveArmazenamento.valor).toBe('3f2504e0-4f89-41d3-9a0c-0305e82c3301');
    expect(lido?.tamanhoBytes).toBe(2481003);
    expect(lido?.situacao).toBe(SituacaoDocumento.RECEIVED);
  });

  // O indice unico e a garantia de verdade contra o fato (c). O repositorio
  // traduz o codigo 23505 do Postgres para que o caso de uso nao precise
  // conhecer erro de driver.
  it('traduz a violacao do indice unico em ConflitoDeHash', async () => {
    await documentos.salvar(novoDocumento());
    await expect(documentos.salvar(novoDocumento())).rejects.toBeInstanceOf(ConflitoDeHash);
  });

  it('grava campos e motivos, respeitando ck_doc_motivos_coerentes', async () => {
    const salvo = await documentos.salvar(novoDocumento());
    const tipo = await catalogo.buscarPorCodigo('RG');
    salvo.iniciarProcessamento(new Date());

    const campos = [
      CampoExtraido.doModelo('nome', 'MARIA FICTICIA', Confianca.de(0.96)),
      CampoExtraido.doModelo('numero', '000000000', Confianca.de(0.4)),
    ];
    const politica = new PoliticaDeConfianca({ tipo: Confianca.de(0.8), campo: Confianca.de(0.85) });

    salvo.concluirExtracao({
      tipo: tipo!,
      confiancaTipo: Confianca.de(0.94),
      decisao: politica.decidir({ tipo: tipo!, confiancaTipo: Confianca.de(0.94), campos }),
      nome: { montou: false, marcadoresSemValor: ['numero'] },
      agora: new Date(),
    });
    await documentos.atualizar(salvo, campos);

    const lido = await documentos.buscarPorId(salvo.id as number);
    expect(lido?.situacao).toBe(SituacaoDocumento.REVIEW_REQUIRED);
    expect(lido?.motivosParaTexto()).toContain('CONFIANCA_CAMPO_BAIXA:numero');
    expect(lido?.tipo?.codigo).toBe('RG');

    const lidos = await documentos.camposDoDocumento(salvo.id as number);
    expect(lidos.map((c) => c.nome).sort()).toEqual(['nome', 'numero']);
    // NUMERIC volta como string do driver; o transformador precisa devolver
    // numero, senao Confianca.de receberia "0.960".
    expect(lidos.find((c) => c.nome === 'numero')?.confianca.valor).toBe(0.4);
  });

  it('substitui o conjunto de campos em vez de acumular', async () => {
    const salvo = await documentos.salvar(novoDocumento());
    await documentos.atualizar(salvo, [
      CampoExtraido.doModelo('nome', 'PRIMEIRO', Confianca.de(0.9)),
    ]);
    await documentos.atualizar(salvo, [
      CampoExtraido.doModelo('nome', 'SEGUNDO', Confianca.de(0.9)),
    ]);

    const lidos = await documentos.camposDoDocumento(salvo.id as number);
    expect(lidos).toHaveLength(1);
    expect(lidos[0].valor).toBe('SEGUNDO');
  });

  it('resume as submissoes do documento, que e o bloco do GET', async () => {
    const salvo = await documentos.salvar(novoDocumento());
    const id = salvo.id as number;
    const em = (ms: number) => new Date(Date.now() + ms);

    await submissoes.registrar(
      Submissao.registrar({ nomeOriginal: 'WhatsApp Image.jpeg', sistemaOrigem: 'crm', criadoEm: em(0) }),
      id,
    );
    await submissoes.registrar(
      Submissao.registrar({ nomeOriginal: 'scan0001.pdf', sistemaOrigem: 'balcao', criadoEm: em(1000) }),
      id,
    );

    const resumo = await submissoes.resumoPorDocumento(id);
    expect(resumo.total).toBe(2);
    expect([...resumo.canais].sort()).toEqual(["balcao", "crm"]);
    expect(resumo.nomeOriginalMaisRecente).toBe('scan0001.pdf');
  });

  // Unicidade e do par, e nao da chave. Ver ADR-006.
  it('deixa dois sistemas usarem a mesma chave de idempotencia', async () => {
    const salvo = await documentos.salvar(novoDocumento());
    const id = salvo.id as number;
    const comChave = (sistema: string) =>
      Submissao.registrar({
        nomeOriginal: 'a.jpg',
        sistemaOrigem: sistema,
        criadoEm: new Date(),
        chaveIdempotencia: 'req-1',
      });

    await submissoes.registrar(comChave('crm'), id);
    await expect(submissoes.registrar(comChave('balcao'), id)).resolves.toBeDefined();
    await expect(submissoes.registrar(comChave('crm'), id)).rejects.toThrow();

    expect((await submissoes.buscarPorIdempotencia('crm', 'req-1'))?.sistemaOrigem).toBe('crm');
  });

  it('registra tentativas e devolve a ultima', async () => {
    const salvo = await documentos.salvar(novoDocumento());
    const id = salvo.id as number;
    const base = { documentoId: id, provedor: 'duble', modelo: 'duble-1', versaoPrompt: 'v1' };

    await processamentos.registrar({ ...base, tentativa: 1, sucesso: false, erroCodigo: 'TIMEOUT', erroMensagem: 'sem resposta', duracaoMs: 60000 });
    await processamentos.registrar({ ...base, tentativa: 2, sucesso: true, duracaoMs: 12000, custoEstimado: 0.004 });

    expect(await processamentos.contarDoDocumento(id)).toBe(2);
    const ultima = await processamentos.ultimaDoDocumento(id);
    expect(ultima).toMatchObject({ tentativa: 2, sucesso: true, custoEstimado: 0.004 });
  });

  // ck_pro_erro_coerente e o que garante que a taxa de falha do fornecedor nao
  // vire um monte de linha sem motivo registrado.
  it('recusa tentativa que falhou sem codigo de erro', async () => {
    const salvo = await documentos.salvar(novoDocumento());
    await expect(
      processamentos.registrar({
        documentoId: salvo.id as number,
        tentativa: 1,
        provedor: 'duble',
        modelo: 'duble-1',
        versaoPrompt: 'v1',
        sucesso: false,
      }),
    ).rejects.toThrow();
  });

  // ON DELETE SET NULL. Quando a politica de retencao existir, apagar o dado
  // pessoal nao pode apagar a prova de quem o acessou antes.
  it('mantem a auditoria depois de o documento ser apagado', async () => {
    const salvo = await documentos.salvar(novoDocumento());
    const id = salvo.id as number;
    await auditoria.registrar({
      documentoId: id,
      acao: 'EXTRACAO_CONCLUIDA',
      ator: 'worker',
      detalhe: { campos: ['nome', 'numero'], quantidade: 2 },
    });

    await ds.query('DELETE FROM documento WHERE doc_id = $1', [id]);

    const [evento] = await ds.query('SELECT eva_doc_id, eva_detalhe FROM evento_auditoria');
    expect(evento.eva_doc_id).toBeNull();
    expect(evento.eva_detalhe).toEqual({ campos: ['nome', 'numero'], quantidade: 2 });
  });

  /**
   * E a garantia que sustenta a afirmacao do ADR-004 sobre o adaptador de fila
   * em Postgres: gravar o documento e criar o trabalho cabem na mesma transacao.
   */
  it('desfaz tudo quando o bloco da unidade de trabalho falha', async () => {
    await expect(
      unidade.executar(async () => {
        const salvo = await documentos.salvar(novoDocumento());
        await submissoes.registrar(
          Submissao.registrar({ nomeOriginal: 'a.jpg', sistemaOrigem: 'crm', criadoEm: new Date() }),
          salvo.id as number,
        );
        throw new Error('falha depois de gravar');
      }),
    ).rejects.toThrow('falha depois de gravar');

    const [{ count }] = await ds.query('SELECT count(*)::int AS count FROM documento');
    expect(count).toBe(0);
    const [submissao] = await ds.query('SELECT count(*)::int AS count FROM submissao');
    expect(submissao.count).toBe(0);
  });

  it('le o catalogo semeado pela migration', async () => {
    const rg = await catalogo.buscarPorCodigo('RG');
    expect(rg?.camposObrigatorios).toContain('orgaoEmissor');
    expect(rg?.catalogoValido).toBe(true);
    expect((await catalogo.desconhecido()).ehDesconhecido).toBe(true);
    // DESCONHECIDO nao e classificavel diretamente: ele e o destino de quem nao
    // esta no catalogo, e nao um tipo que o extrator pode escolher.
    expect(await catalogo.buscarPorCodigo('DESCONHECIDO')).toBeUndefined();
  });
});
