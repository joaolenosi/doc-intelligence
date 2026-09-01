import { DataSource } from 'typeorm';
import {
  RegistroDeProcessamento,
  TentativaDeProcessamento,
} from '../../../../aplicacao/portas/registro-de-processamento.porta';
import { Relogio } from '../../../../aplicacao/portas/relogio.porta';
import { gerenciadorAtual } from '../contexto-transacional';
import { ProcessamentoOrm } from '../entidades/processamento.orm-entity';

function paraDominio(linha: ProcessamentoOrm): TentativaDeProcessamento {
  return {
    documentoId: Number(linha.documentoId),
    tentativa: linha.tentativa,
    provedor: linha.provedor,
    modelo: linha.modelo,
    versaoPrompt: linha.versaoPrompt,
    sucesso: linha.sucesso,
    duracaoMs: linha.duracaoMs ?? undefined,
    custoEstimado: linha.custoEstimado ?? undefined,
    erroCodigo: linha.erroCodigo ?? undefined,
    erroMensagem: linha.erroMensagem ?? undefined,
  };
}

export class RegistroDeProcessamentoTypeOrm implements RegistroDeProcessamento {
  constructor(
    private readonly dataSource: DataSource,
    private readonly relogio: Relogio,
  ) {}

  private get gerenciador() {
    return gerenciadorAtual(this.dataSource);
  }

  async registrar(tentativa: TentativaDeProcessamento): Promise<void> {
    const agora = this.relogio.agora();
    const inicio =
      tentativa.duracaoMs === undefined
        ? agora
        : new Date(agora.getTime() - tentativa.duracaoMs);

    await this.gerenciador.insert(ProcessamentoOrm, {
      documentoId: String(tentativa.documentoId),
      tentativa: tentativa.tentativa,
      provedor: tentativa.provedor,
      modelo: tentativa.modelo,
      versaoPrompt: tentativa.versaoPrompt,
      sucesso: tentativa.sucesso,
      duracaoMs: tentativa.duracaoMs ?? null,
      custoEstimado: tentativa.custoEstimado,
      // ck_pro_erro_coerente recusa tentativa sem sucesso e sem codigo. O banco
      // e a garantia de que a taxa de falha do fornecedor nao vira um monte de
      // linha sem motivo registrado.
      erroCodigo: tentativa.erroCodigo ?? null,
      erroMensagem: tentativa.erroMensagem ?? null,
      iniciadoEm: inicio,
      terminadoEm: agora,
    });
  }

  async contarDoDocumento(documentoId: number): Promise<number> {
    return this.gerenciador.count(ProcessamentoOrm, {
      where: { documentoId: String(documentoId) },
    });
  }

  async ultimaDoDocumento(documentoId: number): Promise<TentativaDeProcessamento | undefined> {
    const linha = await this.gerenciador.findOne(ProcessamentoOrm, {
      where: { documentoId: String(documentoId) },
      order: { iniciadoEm: 'DESC', id: 'DESC' },
    });
    return linha === null ? undefined : paraDominio(linha);
  }
}
