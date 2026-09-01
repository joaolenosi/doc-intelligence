import { ConsultarDocumento } from '../../src/aplicacao/casos-de-uso/consultar-documento.caso-de-uso';
import { DocumentoNaoEncontrado } from '../../src/aplicacao/erros/erros-de-aplicacao';
import { CampoExtraido } from '../../src/dominio/documento/campo-extraido.entidade';
import { ChaveArmazenamento } from '../../src/dominio/documento/chave-armazenamento.vo';
import { Confianca } from '../../src/dominio/documento/confianca.vo';
import { Documento } from '../../src/dominio/documento/documento.entidade';
import { HashConteudo } from '../../src/dominio/documento/hash-conteudo.vo';
import { SituacaoDocumento } from '../../src/dominio/documento/situacao-documento';
import { TipoDocumento } from '../../src/dominio/documento/tipo-documento';
import { Submissao } from '../../src/dominio/submissao/submissao.entidade';
import {
  DocumentosEmMemoria,
  ProcessamentosEmMemoria,
  RelogioFixo,
  SubmissoesEmMemoria,
} from './dubles';

const relogio = new RelogioFixo();

const montar = async () => {
  const documentos = new DocumentosEmMemoria();
  const submissoes = new SubmissoesEmMemoria();
  const processamentos = new ProcessamentosEmMemoria();

  const documento = await documentos.salvar(
    Documento.receber({
      hash: HashConteudo.de('a'.repeat(64)),
      chaveArmazenamento: ChaveArmazenamento.de('00000001-0000-4000-8000-000000000000'),
      tipoMidia: 'image/jpeg',
      tamanhoBytes: 100,
      agora: relogio.agora(),
    }),
  );
  const id = documento.id as number;

  const caso = new ConsultarDocumento({ documentos, submissoes, processamentos });
  return { caso, documentos, submissoes, processamentos, documento, id };
};

const submissao = (nome: string, sistema: string) =>
  Submissao.registrar({ nomeOriginal: nome, sistemaOrigem: sistema, criadoEm: relogio.agora() });

describe('ConsultarDocumento', () => {
  it('falha quando o documento nao existe', async () => {
    const { caso } = await montar();
    await expect(caso.executar(999)).rejects.toBeInstanceOf(DocumentoNaoEncontrado);
  });

  // Documento recem recebido nao tem resultado. Lista vazia e diferente de
  // campo com valor vazio.
  it('nao devolve campos enquanto nao ha resultado', async () => {
    const { caso, id, submissoes } = await montar();
    await submissoes.registrar(submissao('a.jpg', 'crm-atendimento'), id);

    const consulta = await caso.executar(id);

    expect(consulta.situacao).toBe(SituacaoDocumento.RECEIVED);
    expect(consulta.campos).toEqual([]);
    expect(consulta.nomePadronizado).toBeUndefined();
    expect(consulta.processamento.tentativas).toBe(0);
  });

  /**
   * O bloco `submissoes` e a resposta direta ao fato (c). Sem ele, quem consome
   * nao distingue um documento que chegou uma vez de outro que chegou tres.
   */
  it('devolve total, canais e o nome da submissao mais recente', async () => {
    const { caso, id, submissoes } = await montar();
    await submissoes.registrar(submissao('WhatsApp Image 2026-08-11.jpeg', 'crm-atendimento'), id);
    await submissoes.registrar(submissao('scan0001.pdf', 'portal-balcao'), id);
    await submissoes.registrar(submissao('IMG_0042.jpg', 'crm-atendimento'), id);

    const consulta = await caso.executar(id);

    expect(consulta.submissoes).toEqual({
      total: 3,
      canais: ['crm-atendimento', 'portal-balcao'],
      nomeOriginalMaisRecente: 'IMG_0042.jpg',
    });
  });

  it('monta o bloco de processamento a partir da ultima tentativa', async () => {
    const { caso, id, processamentos } = await montar();
    await processamentos.registrar({
      documentoId: id,
      tentativa: 1,
      provedor: 'duble',
      modelo: 'duble-deterministico-1',
      versaoPrompt: 'extracao-rg.v1',
      sucesso: false,
      erroCodigo: 'TIMEOUT',
      erroMensagem: 'sem resposta em 60000ms',
    });
    await processamentos.registrar({
      documentoId: id,
      tentativa: 2,
      provedor: 'duble',
      modelo: 'duble-deterministico-2',
      versaoPrompt: 'extracao-rg.v2',
      sucesso: true,
    });

    const consulta = await caso.executar(id);

    expect(consulta.processamento).toEqual({
      tentativas: 2,
      provedor: 'duble',
      modelo: 'duble-deterministico-2',
      versaoPrompt: 'extracao-rg.v2',
      erro: undefined,
    });
  });

  it('expoe o erro da ultima tentativa quando o documento falhou', async () => {
    const { caso, id, processamentos } = await montar();
    await processamentos.registrar({
      documentoId: id,
      tentativa: 1,
      provedor: 'duble',
      modelo: 'duble-deterministico-1',
      versaoPrompt: 'extracao-rg.v1',
      sucesso: false,
      erroCodigo: 'TIMEOUT',
      erroMensagem: 'sem resposta em 60000ms',
    });

    const consulta = await caso.executar(id);

    expect(consulta.processamento.erro).toEqual({
      codigo: 'TIMEOUT',
      mensagem: 'sem resposta em 60000ms',
    });
  });

  it('devolve campos e motivos quando o documento parou para conferencia', async () => {
    const { caso, id, documentos, documento } = await montar();
    documento.iniciarProcessamento(relogio.agora());
    documento.concluirExtracao({
      tipo: TipoDocumento.de({
        codigo: 'RG',
        templateNome: '{tipo}_{nome}_{data}.{extensao}',
        camposObrigatorios: ['nome'],
      }),
      confiancaTipo: Confianca.de(0.94),
      decisao: { situacao: SituacaoDocumento.REVIEW_REQUIRED, motivos: [] },
      nome: { montou: false, marcadoresSemValor: ['nome'] },
      agora: relogio.agora(),
    });
    await documentos.atualizar(documento, [
      CampoExtraido.doModelo('nome', 'MARIA DA SILVA', Confianca.de(0.4)),
    ]);

    const consulta = await caso.executar(id);

    expect(consulta.situacao).toBe(SituacaoDocumento.REVIEW_REQUIRED);
    expect(consulta.motivosRevisao).toEqual(['NOME_INCOMPLETO:nome']);
    expect(consulta.campos).toEqual([
      { nome: 'nome', valor: 'MARIA DA SILVA', confianca: 0.4, origem: 'MODELO' },
    ]);
    // Nome nao montou, entao nao ha nome padronizado para propor.
    expect(consulta.nomePadronizado).toBeUndefined();
  });
});
