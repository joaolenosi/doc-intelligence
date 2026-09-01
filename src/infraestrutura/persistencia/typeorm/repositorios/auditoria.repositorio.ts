import { DataSource } from 'typeorm';
import {
  EventoDeAuditoria,
  RegistroDeAuditoria,
} from '../../../../aplicacao/portas/registro-de-auditoria.porta';
import { Relogio } from '../../../../aplicacao/portas/relogio.porta';
import { gerenciadorAtual } from '../contexto-transacional';
import { EventoAuditoriaOrm } from '../entidades/evento-auditoria.orm-entity';

/**
 * Grava a trilha de acesso.
 *
 * A chave estrangeira e ON DELETE SET NULL, entao o registro de que alguem
 * acessou um documento sobrevive ao apagamento do documento. Quando a politica
 * de retencao existir, apagar o dado pessoal nao pode apagar a prova de quem o
 * acessou antes.
 */
export class RegistroDeAuditoriaTypeOrm implements RegistroDeAuditoria {
  constructor(
    private readonly dataSource: DataSource,
    private readonly relogio: Relogio,
  ) {}

  async registrar(evento: EventoDeAuditoria): Promise<void> {
    const gerenciador = gerenciadorAtual(this.dataSource);
    const linha = gerenciador.create(EventoAuditoriaOrm, {
      documentoId: evento.documentoId === undefined ? null : String(evento.documentoId),
      acao: evento.acao,
      ator: evento.ator,
      // O caso de uso ja monta o detalhe so com nome de campo e contagem. Aqui
      // nao ha filtro adicional de proposito: filtro em dois lugares vira
      // desculpa para relaxar o primeiro.
      detalhe: { ...evento.detalhe },
      criadoEm: this.relogio.agora(),
    });
    await gerenciador.save(linha);
  }
}
