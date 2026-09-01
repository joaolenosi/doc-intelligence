import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { numerico } from './transformadores';

/** Espelha a tabela `processamento`. Uma linha por tentativa. Ver ADR-011. */
@Entity({ name: 'processamento' })
export class ProcessamentoOrm {
  @PrimaryGeneratedColumn({ name: 'pro_id', type: 'bigint' })
  id!: string;

  @Column({ name: 'pro_doc_id', type: 'bigint' })
  documentoId!: string;

  @Column({ name: 'pro_tentativa', type: 'smallint' })
  tentativa!: number;

  @Column({ name: 'pro_provedor', type: 'varchar', length: 50 })
  provedor!: string;

  @Column({ name: 'pro_modelo', type: 'varchar', length: 100 })
  modelo!: string;

  @Column({ name: 'pro_versao_prompt', type: 'varchar', length: 50 })
  versaoPrompt!: string;

  @Column({ name: 'pro_sucesso', type: 'boolean' })
  sucesso!: boolean;

  @Column({ name: 'pro_duracao_ms', type: 'int', nullable: true })
  duracaoMs?: number | null;

  @Column({ name: 'pro_custo_estimado', type: 'numeric', precision: 10, scale: 6, nullable: true, transformer: numerico })
  custoEstimado?: number;

  @Column({ name: 'pro_erro_codigo', type: 'varchar', length: 50, nullable: true })
  erroCodigo?: string | null;

  @Column({ name: 'pro_erro_mensagem', type: 'text', nullable: true })
  erroMensagem?: string | null;

  @Column({ name: 'pro_iniciado_em', type: 'timestamptz' })
  iniciadoEm!: Date;

  @Column({ name: 'pro_terminado_em', type: 'timestamptz', nullable: true })
  terminadoEm?: Date | null;
}
