import { Documento } from '../../dominio/documento/documento.entidade';
import { extensaoDe } from '../../dominio/documento/tipo-midia';
import { Submissao } from '../../dominio/submissao/submissao.entidade';
import { ArquivoRecusado, ConflitoDeHash } from '../erros/erros-de-aplicacao';
import { ArmazenamentoDeArquivo } from '../portas/armazenamento-de-arquivo.porta';
import { CalculadoraDeHash } from '../portas/calculadora-de-hash.porta';
import { InspetorDeArquivo } from '../portas/inspetor-de-arquivo.porta';
import { PublicadorDeProcessamento } from '../portas/publicador-de-processamento.porta';
import { Relogio } from '../portas/relogio.porta';
import { RepositorioDeDocumento } from '../portas/repositorio-de-documento.porta';
import { RepositorioDeSubmissao } from '../portas/repositorio-de-submissao.porta';
import { UnidadeDeTrabalho } from '../portas/unidade-de-trabalho.porta';

export interface EntradaDeRecebimento {
  readonly conteudo: Uint8Array;
  readonly nomeOriginal: string;
  readonly sistemaOrigem: string;
  readonly tipoMidiaInformado?: string;
  readonly chaveIdempotencia?: string;
}

export interface SaidaDeRecebimento {
  readonly documento: Documento;
  /** `true` vira 201, `false` vira 200. Ver ADR-006. */
  readonly criado: boolean;
}

export interface ConfiguracaoDeRecebimento {
  readonly tamanhoMaximoBytes: number;
}

export interface DependenciasDeRecebimento {
  readonly documentos: RepositorioDeDocumento;
  readonly submissoes: RepositorioDeSubmissao;
  readonly armazenamento: ArmazenamentoDeArquivo;
  readonly inspetor: InspetorDeArquivo;
  readonly hash: CalculadoraDeHash;
  readonly publicador: PublicadorDeProcessamento;
  readonly unidadeDeTrabalho: UnidadeDeTrabalho;
  readonly relogio: Relogio;
  readonly configuracao: ConfiguracaoDeRecebimento;
}

/**
 * Recebe um documento e devolve na hora, sem esperar o modelo.
 *
 * O fato (a) diz que a chamada leva ate 40 segundos e o fato (e) diz que o pico
 * concentra 800 documentos em duas horas. Processar dentro do request seguraria
 * uma conexao por documento e derrubaria o servico antes de derrubar o
 * fornecedor. Ver ADR-003.
 *
 * Classe comum, sem decorator, recebendo tudo pelo construtor. Instancia com
 * `new` num teste, sem contexto de framework. Ver ADR-002.
 */
export class ReceberDocumento {
  constructor(private readonly deps: DependenciasDeRecebimento) {}

  async executar(entrada: EntradaDeRecebimento): Promise<SaidaDeRecebimento> {
    // Validacao antes de qualquer escrita e antes de qualquer custo. Arquivo
    // recusado nao vira documento: ele nunca chegou a existir para o sistema.
    if (entrada.conteudo.length === 0) {
      throw new ArquivoRecusado('Arquivo vazio', 'ARQUIVO_VAZIO');
    }
    if (entrada.conteudo.length > this.deps.configuracao.tamanhoMaximoBytes) {
      throw new ArquivoRecusado(
        `Arquivo acima de ${this.deps.configuracao.tamanhoMaximoBytes} bytes`,
        'TAMANHO_EXCEDIDO',
      );
    }

    // O tipo sai dos bytes. Nome, extensao e content-type informados sao
    // metadado e nao entram em decisao nenhuma. Fato (b).
    const tipoMidia = this.deps.inspetor.inspecionar(entrada.conteudo);

    const porIdempotencia = await this.buscarPorIdempotencia(entrada);
    if (porIdempotencia !== undefined) return porIdempotencia;

    const hash = this.deps.hash.calcular(entrada.conteudo);

    // Fato (c): o mesmo documento chega mais de uma vez. Consultar antes evita
    // a chamada paga; o indice unico no banco e o que garante em corrida.
    const existente = await this.deps.documentos.buscarPorHash(hash);
    if (existente !== undefined) {
      return this.registrarReenvio(existente, entrada);
    }

    try {
      return await this.criar(entrada, tipoMidia, hash);
    } catch (erro) {
      if (!(erro instanceof ConflitoDeHash)) throw erro;
      // Outra requisicao com o mesmo conteudo ganhou a corrida entre a consulta
      // e a gravacao. O reenvio e o comportamento esperado, entao nao e erro.
      const agoraExistente = await this.deps.documentos.buscarPorHash(hash);
      if (agoraExistente === undefined) throw erro;
      return this.registrarReenvio(agoraExistente, entrada);
    }
  }

  private async buscarPorIdempotencia(
    entrada: EntradaDeRecebimento,
  ): Promise<SaidaDeRecebimento | undefined> {
    if (entrada.chaveIdempotencia === undefined) return undefined;

    const submissao = await this.deps.submissoes.buscarPorIdempotencia(
      entrada.sistemaOrigem,
      entrada.chaveIdempotencia,
    );
    if (submissao?.documentoId === undefined) return undefined;

    const documento = await this.deps.documentos.buscarPorId(submissao.documentoId);
    if (documento === undefined) return undefined;

    // A mesma requisicao repetida por timeout de rede nao cria uma submissao
    // nova. Isso e diferente do reenvio do fato (c), que cria. Ver ADR-006.
    return { documento, criado: false };
  }

  private async registrarReenvio(
    documento: Documento,
    entrada: EntradaDeRecebimento,
  ): Promise<SaidaDeRecebimento> {
    await this.deps.unidadeDeTrabalho.executar(async () => {
      await this.deps.submissoes.registrar(this.novaSubmissao(entrada), documento.id as number);
    });
    // O 200 nao significa "nao fiz nada": o documento nao foi reprocessado, mas
    // a submissao foi registrada, e o GET passa a contar mais um envio e mais um
    // canal. Ver ADR-006.
    return { documento, criado: false };
  }

  private async criar(
    entrada: EntradaDeRecebimento,
    tipoMidia: string,
    hash: ReturnType<CalculadoraDeHash['calcular']>,
  ): Promise<SaidaDeRecebimento> {
    const chave = await this.deps.armazenamento.guardar(entrada.conteudo, extensaoDe(tipoMidia));

    return this.deps.unidadeDeTrabalho.executar(async () => {
      const documento = await this.deps.documentos.salvar(
        Documento.receber({
          hash,
          chaveArmazenamento: chave,
          tipoMidia,
          tamanhoBytes: entrada.conteudo.length,
          agora: this.deps.relogio.agora(),
        }),
      );

      await this.deps.submissoes.registrar(this.novaSubmissao(entrada), documento.id as number);

      // Publicar dentro da transacao e o que faz a janela do ADR-004 nao
      // existir no adaptador Postgres. Com BullMQ ela continua existindo,
      // porque o Redis nao participa desta transacao.
      await this.deps.publicador.publicar(documento.id as number);

      return { documento, criado: true };
    });
  }

  private novaSubmissao(entrada: EntradaDeRecebimento): Submissao {
    return Submissao.registrar({
      nomeOriginal: entrada.nomeOriginal,
      sistemaOrigem: entrada.sistemaOrigem,
      criadoEm: this.deps.relogio.agora(),
      tipoMidiaInformado: entrada.tipoMidiaInformado,
      chaveIdempotencia: entrada.chaveIdempotencia,
    });
  }
}
