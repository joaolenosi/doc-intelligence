import { CampoExtraido } from '../../src/dominio/documento/campo-extraido.entidade';
import { ChaveArmazenamento } from '../../src/dominio/documento/chave-armazenamento.vo';
import { Documento } from '../../src/dominio/documento/documento.entidade';
import { HashConteudo } from '../../src/dominio/documento/hash-conteudo.vo';
import { TipoDocumento } from '../../src/dominio/documento/tipo-documento';
import { ehTipoAceito } from '../../src/dominio/documento/tipo-midia';
import { Submissao } from '../../src/dominio/submissao/submissao.entidade';
import { ArquivoRecusado, ConflitoDeHash } from '../../src/aplicacao/erros/erros-de-aplicacao';
import { ArmazenamentoDeArquivo } from '../../src/aplicacao/portas/armazenamento-de-arquivo.porta';
import { CalculadoraDeHash } from '../../src/aplicacao/portas/calculadora-de-hash.porta';
import { CatalogoDeTipos } from '../../src/aplicacao/portas/catalogo-de-tipos.porta';
import {
  ExtratorDeDocumento,
  ResultadoDaExtracao,
} from '../../src/aplicacao/portas/extrator-de-documento.porta';
import { InspetorDeArquivo } from '../../src/aplicacao/portas/inspetor-de-arquivo.porta';
import { PublicadorDeProcessamento } from '../../src/aplicacao/portas/publicador-de-processamento.porta';
import {
  EventoDeAuditoria,
  RegistroDeAuditoria,
} from '../../src/aplicacao/portas/registro-de-auditoria.porta';
import {
  RegistroDeProcessamento,
  TentativaDeProcessamento,
} from '../../src/aplicacao/portas/registro-de-processamento.porta';
import { Relogio } from '../../src/aplicacao/portas/relogio.porta';
import { RepositorioDeDocumento } from '../../src/aplicacao/portas/repositorio-de-documento.porta';
import {
  RepositorioDeSubmissao,
  ResumoDeSubmissoes,
} from '../../src/aplicacao/portas/repositorio-de-submissao.porta';
import { UnidadeDeTrabalho } from '../../src/aplicacao/portas/unidade-de-trabalho.porta';

/**
 * Dubles de porta em memoria.
 *
 * Existem porque o ADR-002 tornou os casos de uso instanciaveis com `new`: sem
 * decorator e sem container, o teste monta as dependencias na mao e nao precisa
 * de banco, de Redis nem de contexto de framework.
 */

export class RelogioFixo implements Relogio {
  constructor(private instante = new Date('2026-09-01T12:00:00Z')) {}
  agora(): Date {
    return this.instante;
  }
  avancar(ms: number): void {
    this.instante = new Date(this.instante.getTime() + ms);
  }
}

/** Deterministico e sem node:crypto, porque o teste so precisa de estabilidade. */
export class HashFake implements CalculadoraDeHash {
  calcular(conteudo: Uint8Array): HashConteudo {
    let h = 0x811c9dc5;
    for (const byte of conteudo) {
      h = Math.imul(h ^ byte, 0x01000193) >>> 0;
    }
    return HashConteudo.de(h.toString(16).padStart(8, '0').repeat(8));
  }
}

export class InspetorFake implements InspetorDeArquivo {
  constructor(private tipoMidia = 'image/jpeg') {}
  definirTipo(tipoMidia: string): void {
    this.tipoMidia = tipoMidia;
  }
  inspecionar(conteudo: Uint8Array): string {
    if (conteudo.length === 0 || !ehTipoAceito(this.tipoMidia)) {
      throw new ArquivoRecusado(`Tipo nao suportado: ${this.tipoMidia}`, 'TIPO_NAO_SUPORTADO');
    }
    return this.tipoMidia;
  }
}

export class ArmazenamentoEmMemoria implements ArmazenamentoDeArquivo {
  readonly arquivos = new Map<string, Uint8Array>();
  private proximo = 1;

  async guardar(conteudo: Uint8Array): Promise<ChaveArmazenamento> {
    const chave = ChaveArmazenamento.de(
      `${this.proximo.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`,
    );
    this.proximo += 1;
    this.arquivos.set(chave.valor, conteudo);
    return chave;
  }

  async ler(chave: ChaveArmazenamento): Promise<Uint8Array> {
    const conteudo = this.arquivos.get(chave.valor);
    if (conteudo === undefined) throw new Error(`Arquivo ${chave.valor} nao encontrado`);
    return conteudo;
  }
}

export class DocumentosEmMemoria implements RepositorioDeDocumento {
  private readonly porId = new Map<number, Documento>();
  private readonly porHash = new Map<string, number>();
  private readonly campos = new Map<number, readonly CampoExtraido[]>();
  private proximoId = 1;

  async salvar(documento: Documento): Promise<Documento> {
    // O indice unico do banco, em memoria. E o que garante em corrida, e a
    // consulta por hash e so otimizacao. Fato (c).
    if (this.porHash.has(documento.hash.valor)) {
      throw new ConflitoDeHash(documento.hash.valor);
    }
    const id = this.proximoId++;
    const comId = Documento.reconstituir({
      id,
      hash: documento.hash,
      chaveArmazenamento: documento.chaveArmazenamento,
      tipoMidia: documento.tipoMidia,
      tamanhoBytes: documento.tamanhoBytes,
      situacao: documento.situacao,
      criadoEm: documento.criadoEm,
      atualizadoEm: documento.atualizadoEm,
      versao: documento.versao,
    });
    this.porId.set(id, comId);
    this.porHash.set(documento.hash.valor, id);
    return comId;
  }

  async atualizar(documento: Documento, campos?: readonly CampoExtraido[]): Promise<void> {
    this.porId.set(documento.id as number, documento);
    if (campos !== undefined) this.campos.set(documento.id as number, campos);
  }

  async buscarPorId(id: number): Promise<Documento | undefined> {
    return this.porId.get(id);
  }

  async buscarPorHash(hash: HashConteudo): Promise<Documento | undefined> {
    const id = this.porHash.get(hash.valor);
    return id === undefined ? undefined : this.porId.get(id);
  }

  async camposDoDocumento(documentoId: number): Promise<readonly CampoExtraido[]> {
    return this.campos.get(documentoId) ?? [];
  }
}

export class SubmissoesEmMemoria implements RepositorioDeSubmissao {
  readonly registros: { submissao: Submissao; documentoId: number }[] = [];
  private proximoId = 1;

  async registrar(submissao: Submissao, documentoId: number): Promise<Submissao> {
    const salva = Submissao.reconstituir({
      id: this.proximoId++,
      documentoId,
      nomeOriginal: submissao.nomeOriginal,
      sistemaOrigem: submissao.sistemaOrigem,
      criadoEm: submissao.criadoEm,
      tipoMidiaInformado: submissao.tipoMidiaInformado,
      chaveIdempotencia: submissao.chaveIdempotencia,
    });
    this.registros.push({ submissao: salva, documentoId });
    return salva;
  }

  async buscarPorIdempotencia(sistemaOrigem: string, chave: string): Promise<Submissao | undefined> {
    // Unicidade e do par, e nao da chave. Ver ADR-006.
    return this.registros.find(
      (r) => r.submissao.sistemaOrigem === sistemaOrigem && r.submissao.chaveIdempotencia === chave,
    )?.submissao;
  }

  async resumoPorDocumento(documentoId: number): Promise<ResumoDeSubmissoes> {
    const doDocumento = this.registros.filter((r) => r.documentoId === documentoId);
    return {
      total: doDocumento.length,
      canais: [...new Set(doDocumento.map((r) => r.submissao.sistemaOrigem))],
      nomeOriginalMaisRecente:
        doDocumento[doDocumento.length - 1]?.submissao.nomeOriginal ?? '',
    };
  }
}

export class ProcessamentosEmMemoria implements RegistroDeProcessamento {
  readonly tentativas: TentativaDeProcessamento[] = [];

  async registrar(tentativa: TentativaDeProcessamento): Promise<void> {
    this.tentativas.push(tentativa);
  }
  async contarDoDocumento(documentoId: number): Promise<number> {
    return this.tentativas.filter((t) => t.documentoId === documentoId).length;
  }
  async ultimaDoDocumento(documentoId: number): Promise<TentativaDeProcessamento | undefined> {
    return this.tentativas.filter((t) => t.documentoId === documentoId).at(-1);
  }
}

export class AuditoriaEmMemoria implements RegistroDeAuditoria {
  readonly eventos: EventoDeAuditoria[] = [];
  async registrar(evento: EventoDeAuditoria): Promise<void> {
    this.eventos.push(evento);
  }
}

export class PublicadorEmMemoria implements PublicadorDeProcessamento {
  readonly publicados: number[] = [];
  async publicar(documentoId: number): Promise<void> {
    this.publicados.push(documentoId);
  }
}

/** Sem transacao. O teste nao precisa dela, e a porta permite. */
export class UnidadeDeTrabalhoDireta implements UnidadeDeTrabalho {
  async executar<T>(trabalho: () => Promise<T>): Promise<T> {
    return trabalho();
  }
}

export class CatalogoEmMemoria implements CatalogoDeTipos {
  constructor(private readonly tipos: readonly TipoDocumento[]) {}
  async buscarPorCodigo(codigo: string): Promise<TipoDocumento | undefined> {
    return this.tipos.find((tipo) => tipo.codigo === codigo && !tipo.ehDesconhecido);
  }
  async desconhecido(): Promise<TipoDocumento> {
    return TipoDocumento.de({
      codigo: 'DESCONHECIDO',
      templateNome: '{tipo}_{data}.{extensao}',
      camposObrigatorios: [],
    });
  }
}

/**
 * Conta as chamadas, que e o que os testes de custo verificam: o fato (a) diz
 * que cada chamada e cobrada, entao "quantas vezes foi chamado" e assercao de
 * negocio e nao detalhe de implementacao.
 */
export class ExtratorFake implements ExtratorDeDocumento {
  chamadas = 0;
  private roteiro: (() => Promise<ResultadoDaExtracao>)[] = [];

  constructor(private padrao: ResultadoDaExtracao) {}

  /** Define o que acontece em cada chamada, na ordem. */
  programar(...passos: (ResultadoDaExtracao | Error)[]): void {
    this.roteiro = passos.map((passo) => async () => {
      if (passo instanceof Error) throw passo;
      return passo;
    });
  }

  async extrair(): Promise<ResultadoDaExtracao> {
    const passo = this.roteiro[this.chamadas];
    this.chamadas += 1;
    return passo === undefined ? this.padrao : passo();
  }
}
