import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { numerico } from './transformadores';

/**
 * Espelha a tabela `campo_extraido`.
 *
 * Uma linha por campo, com confianca individual, e nao JSONB com confianca
 * agregada. Media esconde. Ver ADR-007.
 *
 * `valor` e a coluna com dado pessoal do fato (d), e a unica cujo conteudo
 * nunca pode aparecer em log nem em resposta de listagem.
 */
@Entity({ name: 'campo_extraido' })
export class CampoExtraidoOrm {
  @PrimaryGeneratedColumn({ name: 'cae_id', type: 'bigint' })
  id!: string;

  @Column({ name: 'cae_doc_id', type: 'bigint' })
  documentoId!: string;

  @Column({ name: 'cae_nome', type: 'varchar', length: 60 })
  nome!: string;

  @Column({ name: 'cae_valor', type: 'text' })
  valor!: string;

  @Column({ name: 'cae_confianca', type: 'numeric', precision: 4, scale: 3, transformer: numerico })
  confianca!: number;

  @Column({ name: 'cae_origem', type: 'varchar', length: 20 })
  origem!: string;

  @Column({ name: 'cae_atualizado_em', type: 'timestamptz' })
  atualizadoEm!: Date;
}
