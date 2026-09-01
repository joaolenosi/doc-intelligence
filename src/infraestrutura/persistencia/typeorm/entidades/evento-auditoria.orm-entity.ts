import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Espelha a tabela `evento_auditoria`. `detalhe` nunca recebe valor extraido. */
@Entity({ name: 'evento_auditoria' })
export class EventoAuditoriaOrm {
  @PrimaryGeneratedColumn({ name: 'eva_id', type: 'bigint' })
  id!: string;

  @Column({ name: 'eva_doc_id', type: 'bigint', nullable: true })
  documentoId?: string | null;

  @Column({ name: 'eva_acao', type: 'varchar', length: 50 })
  acao!: string;

  @Column({ name: 'eva_ator', type: 'varchar', length: 100 })
  ator!: string;

  @Column({ name: 'eva_detalhe', type: 'jsonb' })
  detalhe!: Record<string, unknown>;

  @Column({ name: 'eva_criado_em', type: 'timestamptz' })
  criadoEm!: Date;
}
