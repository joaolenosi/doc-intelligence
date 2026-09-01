import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Espelha a tabela `fila_processamento`, usada pelo adaptador de fila em
 * Postgres. A tabela e criada sempre, independente de qual adaptador esta
 * ativo, porque migration condicional a variavel de ambiente produz bancos
 * diferentes com o mesmo numero de migration.
 */
@Entity({ name: 'fila_processamento' })
export class FilaProcessamentoOrm {
  @PrimaryGeneratedColumn({ name: 'flp_id', type: 'bigint' })
  id!: string;

  @Column({ name: 'flp_doc_id', type: 'bigint' })
  documentoId!: string;

  @Column({ name: 'flp_situacao', type: 'varchar', length: 20, default: 'PENDENTE' })
  situacao!: string;

  @Column({ name: 'flp_tentativas', type: 'smallint', default: 0 })
  tentativas!: number;

  @Column({ name: 'flp_disponivel_em', type: 'timestamptz' })
  disponivelEm!: Date;

  @Column({ name: 'flp_reservado_em', type: 'timestamptz', nullable: true })
  reservadoEm?: Date | null;

  @Column({ name: 'flp_reservado_por', type: 'varchar', length: 100, nullable: true })
  reservadoPor?: string | null;

  @Column({ name: 'flp_criado_em', type: 'timestamptz' })
  criadoEm!: Date;

  @Column({ name: 'flp_atualizado_em', type: 'timestamptz' })
  atualizadoEm!: Date;
}
