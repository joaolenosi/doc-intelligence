import { DataSource } from 'typeorm';
import { ProcessarDocumento } from '../../src/aplicacao/casos-de-uso/processar-documento.caso-de-uso';
import { FalhaTransitoriaDoExtrator } from '../../src/aplicacao/erros/erros-de-aplicacao';
import { ChaveArmazenamento } from '../../src/dominio/documento/chave-armazenamento.vo';
import { Documento } from '../../src/dominio/documento/documento.entidade';
import { HashConteudo } from '../../src/dominio/documento/hash-conteudo.vo';
import { RelogioDoSistema } from '../../src/infraestrutura/comum/relogio-do-sistema.adapter';
import { ConsumidorPostgres } from '../../src/infraestrutura/fila/postgres/consumidor-postgres';
import { PublicadorPostgres } from '../../src/infraestrutura/fila/postgres/publicador-postgres.adapter';
import { UnidadeDeTrabalhoTypeOrm } from '../../src/infraestrutura/persistencia/typeorm/contexto-transacional';
import { RepositorioDeDocumentoTypeOrm } from '../../src/infraestrutura/persistencia/typeorm/repositorios/documento.repositorio';
import { conectar, limpar } from './ambiente';

let ds: DataSource;
const relogio = new RelogioDoSistema();
let documentos: RepositorioDeDocumentoTypeOrm;
let publicador: PublicadorPostgres;
let unidade: UnidadeDeTrabalhoTypeOrm;

beforeAll(async () => {
  ds = await conectar();
  documentos = new RepositorioDeDocumentoTypeOrm(ds, relogio);
  publicador = new PublicadorPostgres(ds, relogio);
  unidade = new UnidadeDeTrabalhoTypeOrm(ds);
});
afterAll(async () => {
  if (ds?.isInitialized) await ds.destroy();
});
beforeEach(() => limpar(ds));

let contador = 0;
const criarDocumento = async (hash = 'a') => {
  contador += 1;
  return documentos.salvar(
    Documento.receber({
      hash: HashConteudo.de(hash.repeat(64)),
      // A chave de armazenamento tambem e unica, entao cada documento precisa
      // da sua. Foi um documento compartilhando chave que revelou o repositorio
      // traduzindo qualquer violacao unica para ConflitoDeHash.
      chaveArmazenamento: ChaveArmazenamento.de(
        `${contador.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`,
      ),
      tipoMidia: 'image/jpeg',
      tamanhoBytes: 100,
      agora: new Date(),
    }),
  );
};

/** Um caso de uso de mentira, para o teste ser sobre a fila e nao sobre extracao. */
const casoQue = (comportamento: () => Promise<void>) =>
  ({ executar: async () => comportamento() }) as unknown as ProcessarDocumento;

const filaCrua = () =>
  ds.query('SELECT flp_id, flp_doc_id, flp_situacao, flp_tentativas, flp_disponivel_em FROM fila_processamento ORDER BY flp_id');

describe('fila em Postgres', () => {
  /**
   * A afirmacao central do ADR-004: com este adaptador, gravar o documento e
   * criar o trabalho cabem na mesma transacao, entao a janela que existe no
   * BullMQ nao existe aqui. Sem este teste, isso seria retorica.
   */
  it('desfaz o trabalho junto com o documento quando a transacao falha', async () => {
    await expect(
      unidade.executar(async () => {
        const documento = await criarDocumento();
        await publicador.publicar(documento.id as number);
        throw new Error('queda entre gravar e publicar');
      }),
    ).rejects.toThrow('queda entre gravar e publicar');

    expect(await filaCrua()).toHaveLength(0);
    const [{ count }] = await ds.query('SELECT count(*)::int AS count FROM documento');
    expect(count).toBe(0);
  });

  it('grava documento e trabalho juntos quando a transacao conclui', async () => {
    const id = await unidade.executar(async () => {
      const documento = await criarDocumento();
      await publicador.publicar(documento.id as number);
      return documento.id as number;
    });

    const fila = await filaCrua();
    expect(fila).toHaveLength(1);
    expect(Number(fila[0].flp_doc_id)).toBe(id);
    expect(fila[0].flp_situacao).toBe('PENDENTE');
  });

  /**
   * `SKIP LOCKED` e o que faz N workers pegarem trabalhos diferentes sem
   * coordenacao externa. E o mesmo mecanismo que resolve o fato (g) quando a
   * fila de conferencia existir, com duas pessoas abrindo a fila ao mesmo
   * tempo.
   */
  it('dois consumidores concorrentes nunca pegam o mesmo trabalho', async () => {
    for (const hash of ['a', 'b', 'c', 'd']) {
      const documento = await criarDocumento(hash);
      await publicador.publicar(documento.id as number);
    }

    const consumidor = (nome: string) =>
      new ConsumidorPostgres({
        dataSource: ds,
        concorrencia: 1,
        maxTentativas: 3,
        identificacao: nome,
        processar: casoQue(async () => {
          await new Promise((r) => setTimeout(r, 20));
        }),
      });

    const a = consumidor('worker-a');
    const b = consumidor('worker-b');
    // Cada chamada reserva no maximo um trabalho. Rodando em paralelo, se o
    // SKIP LOCKED nao funcionasse, os dois pegariam a mesma linha.
    await Promise.all([
      a.processarUm(),
      b.processarUm(),
      a.processarUm(),
      b.processarUm(),
    ]);

    const fila = await filaCrua();
    const concluidos = fila.filter((linha: { flp_situacao: string }) => linha.flp_situacao === 'CONCLUIDO');
    expect(concluidos).toHaveLength(4);
    // Quatro trabalhos, quatro documentos distintos concluidos. Se o SKIP
    // LOCKED nao funcionasse, dois consumidores pegariam a mesma linha e este
    // conjunto teria menos de quatro elementos.
    expect(new Set(concluidos.map((l: { flp_doc_id: string }) => l.flp_doc_id)).size).toBe(4);
  });

  it('reagenda com espera crescente quando a falha e transitoria', async () => {
    const documento = await criarDocumento();
    await publicador.publicar(documento.id as number);

    const consumidor = new ConsumidorPostgres({
      dataSource: ds,
      concorrencia: 1,
      maxTentativas: 3,
      processar: casoQue(async () => {
        throw new FalhaTransitoriaDoExtrator('fornecedor fora', 'INDISPONIVEL');
      }),
    });

    await consumidor.processarUm();

    const [linha] = await filaCrua();
    expect(linha.flp_situacao).toBe('PENDENTE');
    expect(linha.flp_tentativas).toBe(1);
    // Volta para a fila no futuro, e nao imediatamente: sem a espera, o worker
    // pegaria de novo no mesmo instante e queimaria as tres tentativas contra
    // um fornecedor que ainda esta fora.
    expect(new Date(linha.flp_disponivel_em).getTime()).toBeGreaterThan(Date.now());
  });

  // O teto e finito porque cada tentativa e cobrada. Ver ADR-005.
  it('marca FALHOU ao esgotar as tentativas', async () => {
    const documento = await criarDocumento();
    await publicador.publicar(documento.id as number);
    await ds.query('UPDATE fila_processamento SET flp_tentativas = 2');

    const consumidor = new ConsumidorPostgres({
      dataSource: ds,
      concorrencia: 1,
      maxTentativas: 3,
      processar: casoQue(async () => {
        throw new FalhaTransitoriaDoExtrator('fornecedor fora', 'INDISPONIVEL');
      }),
    });

    await consumidor.processarUm();

    const [linha] = await filaCrua();
    expect(linha.flp_situacao).toBe('FALHOU');
    expect(linha.flp_tentativas).toBe(3);
  });

  it('nao pega trabalho cuja espera ainda nao venceu', async () => {
    const documento = await criarDocumento();
    await publicador.publicar(documento.id as number);
    await ds.query("UPDATE fila_processamento SET flp_disponivel_em = NOW() + interval '1 hour'");

    const consumidor = new ConsumidorPostgres({
      dataSource: ds,
      concorrencia: 1,
      maxTentativas: 3,
      processar: casoQue(async () => {
        throw new Error('nao deveria ter sido chamado');
      }),
    });

    expect(await consumidor.processarUm()).toBe(false);
  });
});
