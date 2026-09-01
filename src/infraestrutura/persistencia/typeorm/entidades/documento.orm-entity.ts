import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { numerico } from './transformadores';

/**
 * Espelha a tabela `documento`.
 *
 * E separada da entidade de dominio de proposito, com mapeamento explicito
 * entre as duas. O ADR-002 exige que o dominio nao conheca TypeORM, e o custo
 * dessa separacao e este arquivo mais o mapeador. Ver ADR-009.
 */
@Entity({ name: 'documento' })
export class DocumentoOrm {
  @PrimaryGeneratedColumn({ name: 'doc_id', type: 'bigint' })
  id!: string;

  @Column({ name: 'doc_hash_conteudo', type: 'char', length: 64 })
  hashConteudo!: string;

  @Column({ name: 'doc_chave_armazenamento', type: 'uuid' })
  chaveArmazenamento!: string;

  @Column({ name: 'doc_tipo_midia', type: 'varchar', length: 100 })
  tipoMidia!: string;

  @Column({ name: 'doc_tamanho_bytes', type: 'bigint' })
  tamanhoBytes!: string;

  @Column({ name: 'doc_situacao', type: 'varchar', length: 30 })
  situacao!: string;

  @Column({ name: 'doc_tpd_id', type: 'int', nullable: true })
  tipoId?: number | null;

  @Column({ name: 'doc_confianca_tipo', type: 'numeric', precision: 4, scale: 3, nullable: true, transformer: numerico })
  confiancaTipo?: number;

  @Column({ name: 'doc_nome_sugerido', type: 'text', nullable: true })
  nomeSugerido?: string | null;

  @Column({ name: 'doc_motivos_revisao', type: 'text', array: true, nullable: true })
  motivosRevisao?: string[] | null;

  @Column({ name: 'doc_versao', type: 'smallint', default: 1 })
  versao!: number;

  @Column({ name: 'doc_criado_em', type: 'timestamptz' })
  criadoEm!: Date;

  @Column({ name: 'doc_atualizado_em', type: 'timestamptz' })
  atualizadoEm!: Date;

  @Column({ name: 'doc_processado_em', type: 'timestamptz', nullable: true })
  processadoEm?: Date | null;
}
