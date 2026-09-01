import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Espelha a tabela `tipo_documento`. Ver ADR-010. */
@Entity({ name: 'tipo_documento' })
export class TipoDocumentoOrm {
  @PrimaryGeneratedColumn({ name: 'tpd_id' })
  id!: number;

  @Column({ name: 'tpd_codigo', type: 'varchar', length: 50 })
  codigo!: string;

  @Column({ name: 'tpd_nome', type: 'varchar', length: 100 })
  nome!: string;

  @Column({ name: 'tpd_template_nome', type: 'text' })
  templateNome!: string;

  @Column({ name: 'tpd_campos_obrigatorios', type: 'text', array: true })
  camposObrigatorios!: string[];

  @Column({ name: 'tpd_ativo', type: 'boolean', default: true })
  ativo!: boolean;

  @Column({ name: 'tpd_criado_em', type: 'timestamptz' })
  criadoEm!: Date;
}
