import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Espelha a tabela `submissao`. Uma linha por envio. Ver ADR-006. */
@Entity({ name: 'submissao' })
export class SubmissaoOrm {
  @PrimaryGeneratedColumn({ name: 'sub_id', type: 'bigint' })
  id!: string;

  @Column({ name: 'sub_doc_id', type: 'bigint' })
  documentoId!: string;

  @Column({ name: 'sub_nome_original', type: 'text' })
  nomeOriginal!: string;

  @Column({ name: 'sub_tipo_midia_informado', type: 'varchar', length: 100, nullable: true })
  tipoMidiaInformado?: string | null;

  @Column({ name: 'sub_sistema_origem', type: 'varchar', length: 50 })
  sistemaOrigem!: string;

  @Column({ name: 'sub_chave_idempotencia', type: 'varchar', length: 100, nullable: true })
  chaveIdempotencia?: string | null;

  @Column({ name: 'sub_criado_em', type: 'timestamptz' })
  criadoEm!: Date;
}
