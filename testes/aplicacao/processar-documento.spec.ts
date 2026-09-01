import { ProcessarDocumento } from '../../src/aplicacao/casos-de-uso/processar-documento.caso-de-uso';
import {
  FalhaPermanenteDoExtrator,
  FalhaTransitoriaDoExtrator,
} from '../../src/aplicacao/erros/erros-de-aplicacao';
import { ResultadoDaExtracao } from '../../src/aplicacao/portas/extrator-de-documento.porta';
import { ChaveArmazenamento } from '../../src/dominio/documento/chave-armazenamento.vo';
import { Confianca } from '../../src/dominio/documento/confianca.vo';
import { Documento } from '../../src/dominio/documento/documento.entidade';
import { HashConteudo } from '../../src/dominio/documento/hash-conteudo.vo';
import { PoliticaDeConfianca } from '../../src/dominio/documento/politica-de-confianca';
import { PoliticaDeNomenclatura } from '../../src/dominio/documento/politica-de-nomenclatura';
import { SituacaoDocumento } from '../../src/dominio/documento/situacao-documento';
import { TipoDocumento } from '../../src/dominio/documento/tipo-documento';
import {
  ArmazenamentoEmMemoria,
  AuditoriaEmMemoria,
  CatalogoEmMemoria,
  DocumentosEmMemoria,
  ExtratorFake,
  ProcessamentosEmMemoria,
  RelogioFixo,
} from './dubles';

const RG = TipoDocumento.de({
  codigo: 'RG',
  templateNome: '{tipo}_{nome}_{numero}_{data}.{extensao}',
  camposObrigatorios: ['nome', 'numero'],
});

const RESULTADO_BOM: ResultadoDaExtracao = {
  tipoCodigo: 'RG',
  confiancaTipo: 0.94,
  campos: [
    { nome: 'nome', valor: 'Maria da Silva', confianca: 0.96 },
    { nome: 'numero', valor: '123456789', confianca: 0.95 },
  ],
  provedor: 'duble',
  modelo: 'duble-deterministico-1',
  versaoPrompt: 'extracao-rg.v1',
  custoEstimado: 0.004,
};

const montar = async (maxTentativas = 3) => {
  const documentos = new DocumentosEmMemoria();
  const processamentos = new ProcessamentosEmMemoria();
  const auditoria = new AuditoriaEmMemoria();
  const armazenamento = new ArmazenamentoEmMemoria();
  const extrator = new ExtratorFake(RESULTADO_BOM);
  const relogio = new RelogioFixo();

  const chave = await armazenamento.guardar(new TextEncoder().encode('bytes ficticios'));
  const documento = await documentos.salvar(
    Documento.receber({
      hash: HashConteudo.de('a'.repeat(64)),
      chaveArmazenamento: ChaveArmazenamento.de(chave.valor),
      tipoMidia: 'image/jpeg',
      tamanhoBytes: 15,
      agora: relogio.agora(),
    }),
  );

  const caso = new ProcessarDocumento({
    documentos,
    processamentos,
    auditoria,
    catalogo: new CatalogoEmMemoria([RG]),
    armazenamento,
    extrator,
    politicaDeConfianca: new PoliticaDeConfianca({
      tipo: Confianca.de(0.8),
      campo: Confianca.de(0.85),
    }),
    politicaDeNomenclatura: new PoliticaDeNomenclatura(),
    relogio,
    configuracao: { maxTentativas },
  });

  const situacao = async () => (await documentos.buscarPorId(documento.id as number))?.situacao;
  const doc = async () => documentos.buscarPorId(documento.id as number);
  return { caso, documentos, processamentos, auditoria, extrator, id: documento.id as number, situacao, doc };
};

describe('ProcessarDocumento', () => {
  it('conclui em PROCESSED e grava o nome padronizado', async () => {
    const { caso, id, doc } = await montar();

    await caso.executar(id);

    const documento = await doc();
    expect(documento?.situacao).toBe(SituacaoDocumento.PROCESSED);
    expect(documento?.nomeSugerido).toBe('RG_MARIA_DA_SILVA_123456789_2026-09-01.jpg');
  });

  // Fato (f): sem isso, quando a extracao piorar depois de uma troca de versao,
  // ninguem consegue provar o que mudou.
  it('registra a tentativa com provedor, modelo, versao de prompt e custo', async () => {
    const { caso, id, processamentos } = await montar();

    await caso.executar(id);

    expect(processamentos.tentativas).toEqual([
      expect.objectContaining({
        tentativa: 1,
        provedor: 'duble',
        modelo: 'duble-deterministico-1',
        versaoPrompt: 'extracao-rg.v1',
        sucesso: true,
        custoEstimado: 0.004,
      }),
    ]);
  });

  describe('falha transitoria', () => {
    const transitoria = () => new FalhaTransitoriaDoExtrator('timeout', 'TIMEOUT');

    it('relanca para o adaptador reagendar, mantendo o documento em PROCESSING', async () => {
      const { caso, id, extrator, situacao } = await montar();
      extrator.programar(transitoria());

      await expect(caso.executar(id)).rejects.toBeInstanceOf(FalhaTransitoriaDoExtrator);
      expect(await situacao()).toBe(SituacaoDocumento.PROCESSING);
    });

    /**
     * O teto e finito porque cada tentativa e cobrada. Retry sem limite num
     * pico e uma fatura, e nao resiliencia. Ver ADR-005.
     */
    it('para em FAILED ao esgotar o teto, e nao relanca mais', async () => {
      const { caso, id, extrator, situacao, processamentos } = await montar(3);
      extrator.programar(transitoria(), transitoria(), transitoria());

      await expect(caso.executar(id)).rejects.toThrow();
      await expect(caso.executar(id)).rejects.toThrow();
      await expect(caso.executar(id)).resolves.toBeUndefined();

      expect(await situacao()).toBe(SituacaoDocumento.FAILED);
      expect(extrator.chamadas).toBe(3);
      expect(processamentos.tentativas.map((t) => t.tentativa)).toEqual([1, 2, 3]);
      expect(processamentos.tentativas.every((t) => !t.sucesso)).toBe(true);
    });

    it('conclui normalmente quando a retentativa da certo', async () => {
      const { caso, id, extrator, situacao } = await montar();
      extrator.programar(transitoria(), RESULTADO_BOM);

      await expect(caso.executar(id)).rejects.toThrow();
      await caso.executar(id);

      expect(await situacao()).toBe(SituacaoDocumento.PROCESSED);
      expect(extrator.chamadas).toBe(2);
    });
  });

  // Repetir o que falhou por motivo deterministico so multiplica o custo sem
  // mudar o resultado.
  it('nao retenta falha permanente: uma chamada so, e FAILED', async () => {
    const { caso, id, extrator, situacao } = await montar();
    extrator.programar(new FalhaPermanenteDoExtrator('formato recusado', 'FORMATO_RECUSADO'));

    await caso.executar(id);

    expect(await situacao()).toBe(SituacaoDocumento.FAILED);
    expect(extrator.chamadas).toBe(1);
  });

  /**
   * Confianca fora da faixa e o fornecedor devolvendo dado malformado. Se a
   * conversao acontecesse depois do registro, a tentativa teria sido gravada
   * como sucesso e o documento ficaria preso em PROCESSING para sempre.
   */
  it('trata resultado malformado como falha permanente, e nao como sucesso', async () => {
    const { caso, id, extrator, situacao, processamentos } = await montar();
    extrator.programar({ ...RESULTADO_BOM, confiancaTipo: 1.5 });

    await caso.executar(id);

    expect(await situacao()).toBe(SituacaoDocumento.FAILED);
    expect(processamentos.tentativas[0]).toMatchObject({
      sucesso: false,
      erroCodigo: 'RESULTADO_MALFORMADO',
      // Sabe-se quem respondeu, que e o que permite dizer qual versao do modelo
      // passou a devolver lixo.
      modelo: 'duble-deterministico-1',
    });
  });

  describe('resultado que exige conferencia', () => {
    it('para em REVIEW_REQUIRED com o motivo dizendo qual campo', async () => {
      const { caso, id, extrator, doc } = await montar();
      extrator.programar({
        ...RESULTADO_BOM,
        campos: [
          { nome: 'nome', valor: 'Maria da Silva', confianca: 0.96 },
          { nome: 'numero', valor: '123456789', confianca: 0.4 },
        ],
      });

      await caso.executar(id);

      const documento = await doc();
      expect(documento?.situacao).toBe(SituacaoDocumento.REVIEW_REQUIRED);
      expect(documento?.motivosParaTexto()).toEqual(['CONFIANCA_CAMPO_BAIXA:numero']);
    });

    it('manda tipo fora do catalogo para DESCONHECIDO e para o documento', async () => {
      const { caso, id, extrator, doc } = await montar();
      extrator.programar({ ...RESULTADO_BOM, tipoCodigo: 'CERTIDAO_DE_ALGO' });

      await caso.executar(id);

      const documento = await doc();
      expect(documento?.tipo?.codigo).toBe('DESCONHECIDO');
      expect(documento?.motivosParaTexto()).toContain('TIPO_DESCONHECIDO');
    });

    // Campo em branco e campo que nao veio, e quem reclama disso e a politica
    // de confianca, nao a conversao.
    it('descarta campo em branco em vez de recusar o resultado inteiro', async () => {
      const { caso, id, extrator, doc } = await montar();
      extrator.programar({
        ...RESULTADO_BOM,
        campos: [
          { nome: 'nome', valor: 'Maria da Silva', confianca: 0.96 },
          { nome: 'numero', valor: '   ', confianca: 0.99 },
        ],
      });

      await caso.executar(id);

      const documento = await doc();
      expect(documento?.situacao).toBe(SituacaoDocumento.REVIEW_REQUIRED);
      expect(documento?.motivosParaTexto()).toEqual([
        'CAMPO_OBRIGATORIO_AUSENTE:numero',
        'NOME_INCOMPLETO:numero',
      ]);
    });
  });

  // O mesmo trabalho pode ser entregue duas vezes: a fila reentrega, e a
  // reconciliacao futura republica. Documento que terminou nao paga de novo.
  it('e idempotente: documento ja terminado nao gera nova chamada', async () => {
    const { caso, id, extrator } = await montar();

    await caso.executar(id);
    await caso.executar(id);
    await caso.executar(id);

    expect(extrator.chamadas).toBe(1);
  });

  // Fato (d) e ADR-012. O evento de auditoria carrega nome de campo e contagem.
  it('nao grava valor de campo nem nome sugerido na auditoria', async () => {
    const { caso, id, auditoria } = await montar();

    await caso.executar(id);

    const serializado = JSON.stringify(auditoria.eventos);
    expect(serializado).toContain('"nome"');
    expect(serializado).not.toContain('MARIA');
    expect(serializado).not.toContain('123456789');
    expect(serializado).not.toContain('RG_MARIA');
  });
});
